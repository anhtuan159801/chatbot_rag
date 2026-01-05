/**
 * ragService.ts
 * -------------------------------------
 * Retrieval-Augmented Generation Service
 * Hybrid Search + Re-Ranking + Cache
 * -------------------------------------
 */
import { InferenceClient } from "@huggingface/inference";
import {
  searchByKeywords,
  searchByVector,
  checkVectorDimension,
  getAiRoles,
  getModels,
  getChunksByKnowledgeBaseId,
} from "./supabaseService.js";
import { reRankResults } from "./reRanker.js";
import { ragCache, embeddingCache } from "./cacheService.js";
import { sanitizeQuery } from "./inputSanitizer.js";

export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  source: "vector" | "keyword" | "hybrid";
  knowledge_base_id?: string;
}

export class RAGService {
  private readonly CACHE_TTL = 300_000; // 5 minutes
  private hfClient: InferenceClient;
  private vectorWeight: number = 0.7;
  private keywordWeight: number = 0.3;
  private minSimilarity: number = 0.1; // Temporarily lowered for debugging

  constructor(hfClient: InferenceClient) {
    this.hfClient = hfClient;
    // Initialize with default values, will be updated when needed
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const { getRagConfig } = await import("./supabaseService.js");
      const config = await getRagConfig();
      this.vectorWeight = config.vectorWeight;
      this.keywordWeight = config.keywordWeight;
      this.minSimilarity = config.minSimilarity;
    } catch (error) {
      console.error(
        "[RAG] Error loading configuration, using defaults:",
        error,
      );
      // Keep default values if config loading fails
    }
  }

  /** Get the embedding model configuration */
  private async getEmbeddingModelConfig(): Promise<string> {
    try {
      const { getRagConfig } = await import("./supabaseService.js");
      const config = await getRagConfig();
      return config.embeddingModel || "BAAI/bge-small-en-v1.5";
    } catch (error) {
      return process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5";
    }
  }

  /**
   * Enhanced Hybrid Search: semantic + keyword with Vietnamese administrative term handling
   * Now fetches ALL chunks from matching documents for complete context
   */
  async searchKnowledge(
    query: string,
    topK: number = 5,
  ): Promise<KnowledgeChunk[]> {
    const sanitizedQuery = sanitizeQuery(query);
    console.log(`\n[RAG] 🔍 Search query: "${sanitizedQuery}"`);
    if (!sanitizedQuery?.trim()) {
      console.warn("[RAG] ⚠️ Empty query received.");
      return [];
    }

    // Reload configuration to ensure we have the latest values
    await this.loadConfig();

    const cacheKey = ragCache.getCacheKey("rag", {
      query: sanitizedQuery,
      topK,
    });
    const cached = ragCache.get<KnowledgeChunk[]>(cacheKey);
    if (cached) {
      console.log("[RAG] ✅ Cache hit.");
      return cached;
    }

    const start = Date.now();
    try {
      // Check dimension integrity
      const dim = await checkVectorDimension("knowledge_chunks", "embedding");
      if (dim && dim !== 384 && dim !== 1024)
        console.warn(
          `[RAG] ⚠️ Vector dimension mismatch (DB=${dim}, expected=384 or 1024)`,
        );

      // Enhanced query processing for Vietnamese administrative terms
      const enhancedQuery = this.enhanceQueryForVietnameseTerms(sanitizedQuery);

      // Perform hybrid search
      const [vectorResults, keywordResults] = await Promise.allSettled([
        this.searchByVector(enhancedQuery, topK * 2),
        this.searchByKeywords(enhancedQuery, topK * 2),
      ]);

      const safeVector =
        vectorResults.status === "fulfilled" ? vectorResults.value : [];
      const safeKeyword =
        keywordResults.status === "fulfilled" ? keywordResults.value : [];

      const merged = this.mergeAndRank(safeVector, safeKeyword, topK);

      // Log initial search results
      console.log(
        `\n[RAG] 📋 Initial search found ${merged.length} matching chunks:`,
      );
      merged.forEach((chunk, i) => {
        const source =
          chunk.metadata?.source || chunk.metadata?.content_url || "Unknown";
        const similarity = (chunk.similarity * 100).toFixed(1);
        console.log(
          `\n[RAG]   ─── Chunk ${i + 1} (Độ liên quan: ${similarity}%) ───`,
        );
        console.log(`[RAG]   Nguồn: ${source}`);
        console.log(
          `[RAG]   Nội dung:\n${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? "..." : ""}`,
        );
      });

      // Optional Re-ranking
      const ranked = await reRankResults(this.hfClient, enhancedQuery, merged);

      // Extract unique knowledge_base_ids from ranked chunks
      const knowledgeBaseIds = new Set<string>();
      ranked.forEach((chunk) => {
        if (chunk.knowledge_base_id) {
          knowledgeBaseIds.add(chunk.knowledge_base_id);
        }
      });

      // Fetch ALL chunks from matching documents
      let finalChunks = ranked;
      if (knowledgeBaseIds.size > 0) {
        console.log(
          `\n[RAG] 📚 Found ${knowledgeBaseIds.size} document(s) matching. Fetching ALL chunks from these documents...`,
        );
        const allChunks = await getChunksByKnowledgeBaseId(
          Array.from(knowledgeBaseIds),
        );

        // Filter out chunks with undefined knowledge_base_id
        const validChunks = allChunks.filter(
          (chunk) => chunk.knowledge_base_id,
        );

        // Group by knowledge_base_id
        const chunksByDoc = new Map<string, any[]>();
        validChunks.forEach((chunk) => {
          if (chunk.knowledge_base_id) {
            if (!chunksByDoc.has(chunk.knowledge_base_id)) {
              chunksByDoc.set(chunk.knowledge_base_id, []);
            }
            chunksByDoc.get(chunk.knowledge_base_id)!.push(chunk);
          }
        });

        // Log all chunks from matching documents
        console.log(
          `\n[RAG] 📖 Total chunks from matching documents: ${validChunks.length}`,
        );
        chunksByDoc.forEach((chunks, docId) => {
          const sourceName =
            chunks[0]?.metadata?.source ||
            chunks[0]?.metadata?.content_url ||
            docId;
          console.log(`\n[RAG]   ═══════════════════════════════════════`);
          console.log(
            `[RAG]   📄 Tài liệu: ${sourceName} (${chunks.length} chunks)`,
          );
          console.log(`[RAG]   ═══════════════════════════════════════`);
          chunks.forEach((chunk, i) => {
            console.log(`\n[RAG]   Chunk ${i + 1}/${chunks.length}:`);
            console.log(
              `[RAG]   ${chunk.content.substring(0, 800)}${chunk.content.length > 800 ? "..." : ""}`,
            );
          });
        });

        // Add document_id to each chunk and use all chunks
        finalChunks = validChunks.map((chunk) => ({
          ...chunk,
          source: "hybrid",
          content: this.cleanText(chunk.content),
        }));
      }

      ragCache.set(cacheKey, finalChunks, this.CACHE_TTL);
      const ms = Date.now() - start;
      console.log(
        `\n[RAG] ✅ Completed hybrid search (${finalChunks.length} total chunks in ${ms}ms)`,
      );

      return finalChunks;
    } catch (err) {
      console.error("[RAG] 💥 Error in RAG pipeline:", err);
      return [];
    }
  }

  /**
   * Enhance query for better Vietnamese administrative term matching
   */
  private enhanceQueryForVietnameseTerms(query: string): string {
    // Common Vietnamese administrative term mappings
    const termMappings: { [key: string]: string[] } = {
      "tạm trú": [
        "tạm trú",
        "đăng ký tạm trú",
        "KT3",
        "khai báo tạm trú",
        "thủ tục tạm trú",
      ],
      "tạm vắng": [
        "tạm vắng",
        "đăng ký tạm vắng",
        "giấy tạm vắng",
        "khai báo tạm vắng",
      ],
      "thường trú": [
        "thường trú",
        "đăng ký thường trú",
        "hộ khẩu",
        "sổ hộ khẩu",
        "KT2",
      ],
      "khai sinh": ["khai sinh", "giấy khai sinh", "đăng ký khai sinh"],
      "khai tử": ["khai tử", "giấy khai tử", "đăng ký khai tử"],
      "đăng ký kết hôn": [
        "kết hôn",
        "đăng ký kết hôn",
        "giấy chứng nhận kết hôn",
      ],
      "ly hôn": ["ly hôn", "giải quyết ly hôn", "thủ tục ly hôn"],
      "cấp giấy phép": [
        "giấy phép",
        "cấp phép",
        "giấy phép xây dựng",
        "giấy phép kinh doanh",
      ],
      "hành chính": [
        "hành chính",
        "thủ tục hành chính",
        "dịch vụ công",
        "cổng dịch vụ công",
      ],
      "giấy tờ": ["giấy tờ", "hồ sơ", "thủ tục", "giấy phép"],
      "lệ phí": ["lệ phí", "phí", "tiền lệ phí", "thu phí"],
      "thời gian": ["thời gian", "thời hạn", "thủ tục", "giải quyết"],
      "nơi cư trú": ["nơi cư trú", "địa chỉ", "chỗ ở", "hộ khẩu"],
      "chứng minh": ["chứng minh", "xác nhận", "xác thực", "chứng thực"],
      "ủy quyền": ["ủy quyền", "ủy nhiệm", "ủy thác", "giấy ủy quyền"],
      "xác nhận": ["xác nhận", "xác thực", "chứng thực", "xác minh"],
    };

    let enhancedQuery = query.toLowerCase();

    // Expand query with related terms
    for (const [mainTerm, relatedTerms] of Object.entries(termMappings)) {
      if (enhancedQuery.includes(mainTerm)) {
        // Add related terms to the query for better matching
        relatedTerms.forEach((term) => {
          if (!enhancedQuery.includes(term)) {
            enhancedQuery += ` ${term}`;
          }
        });
      }
    }

    return enhancedQuery;
  }

  /** Vector search */
  private async searchByVector(query: string, topK: number) {
    console.log(`[RAG] 🧮 Vector search...`);
    const embedding = await this.generateEmbedding(query);
    if (!embedding) return [];

    try {
      const results = await searchByVector(embedding, topK);
      return results.map((r) => ({
        ...r,
        source: "vector" as const,
      }));
    } catch (err) {
      console.error("[RAG] ❌ Vector search failed:", err);
      return [];
    }
  }

  /** Keyword search */
  private async searchByKeywords(query: string, topK: number) {
    console.log(`[RAG] 🔑 Keyword search...`);
    try {
      const results = await searchByKeywords(query, topK);
      return results.map((r) => ({
        ...r,
        source: "keyword" as const,
      }));
    } catch (err) {
      console.error("[RAG] ❌ Keyword search failed:", err);
      return [];
    }
  }

  /** Merge + Rank results */
  private mergeAndRank(
    vectorResults: KnowledgeChunk[],
    keywordResults: KnowledgeChunk[],
    topK: number,
  ): KnowledgeChunk[] {
    const merged: KnowledgeChunk[] = [];
    const seen = new Set<string>();

    const allItems = [...vectorResults, ...keywordResults];
    for (const item of allItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      const score =
        (item.source === "vector" ? this.vectorWeight : 0) * item.similarity +
        (item.source === "keyword" ? this.keywordWeight : 0) * item.similarity;

      // Only add items that meet the minimum similarity threshold
      if (score >= this.minSimilarity) {
        merged.push({
          ...item,
          similarity: score,
          source: "hybrid",
          content: this.cleanText(item.content),
        });
      }
    }

    return merged.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /** Generate embedding */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = embeddingCache.getCacheKey("embedding", {
      text: text.substring(0, 200),
    });
    const cached = embeddingCache.get<number[]>(cacheKey);
    if (cached) return cached;

    try {
      // Try to get embedding model from ai_role_assignments first
      let modelName = await this.getEmbeddingModelConfig();

      // If that fails, try to get from ai_models table
      if (!modelName || modelName === "BAAI/bge-small-en-v1.5") {
        try {
          const roles = await getAiRoles();
          const ragModelId = roles.rag;
          const models = await getModels();
          const embeddingModel = models.find((m) => m.id === ragModelId);

          if (embeddingModel?.model_string) {
            modelName = embeddingModel.model_string;
          }
        } catch (e) {
          // Use fallback
        }
      }

      const response = await this.hfClient.featureExtraction({
        model: modelName,
        inputs: text,
      });

      const emb = Array.isArray(response[0]) ? response[0] : response;
      const embedding = emb as number[];

      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (err) {
      console.error("[RAG] ❌ Embedding generation failed:", err);
      return null;
    }
  }

  /** Clean text (remove HTML, normalize spaces) */
  private cleanText(text: string): string {
    return text
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  formatContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) return "";
    // Extract all unique URLs from the chunks
    const urls = new Set<string>();
    chunks.forEach((chunk) => {
      if (
        chunk.metadata?.content_url &&
        chunk.metadata.content_url.trim() !== ""
      ) {
        urls.add(chunk.metadata.content_url);
      }
      if (chunk.metadata?.source && chunk.metadata.source.trim() !== "") {
        urls.add(chunk.metadata.source);
      }
    });

    const urlsText =
      urls.size > 0
        ? `\n\n=== CÁC NGUỒN THAM KHẢO ===\n${Array.from(urls)
            .map((url, i) => `${i + 1}. ${url}`)
            .join("\n")}\n=== HẾT NGUỒN THAM KHẢO ===\n`
        : "";

    return `=== THÔNG TIN TÌM THẤY TỪ CƠ SỞ DỮ LIỆU ===\n\n${chunks
      .map((chunk, index) => {
        const sourceUrl =
          chunk.metadata?.content_url || chunk.metadata?.source || "";
        const sourceInfo = sourceUrl ? `\n(Nguồn: ${sourceUrl})` : "";
        const similarityInfo = `\n(Độ liên quan: ${(chunk.similarity * 100).toFixed(1)}%)`;
        return `[TÀI LIỆU ${index + 1} - ĐỘ LIÊN QUAN CAO]:\n${chunk.content}${sourceInfo}${similarityInfo}\n`;
      })
      .join("\n")}${urlsText}=== HẾT THÔNG TIN TÌM THẤY ===`;
  }
}
