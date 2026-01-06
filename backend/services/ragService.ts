/**
 * ragService.ts
 * ------------------------------------
 * Retrieval-Augmented Generation Service
 * Hybrid Search + Re-Ranking + Cache
 * ------------------------------------
 */
import { InferenceClient } from "@huggingface/inference";
import {
  searchByKeywords,
  searchByVector,
  getChunksByKnowledgeBaseId,
  getRagConfig as getSupabaseRagConfig, // Renamed to avoid conflict
  checkVectorDimension,
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
  private minSimilarity: number = 0.1;
  private embeddingModel: string = "";

  constructor(hfClient: InferenceClient) {
    this.hfClient = hfClient;
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const config = await getSupabaseRagConfig();
      this.minSimilarity = config.minSimilarity;
      let model = config.embeddingModel;

      // Align embedding model with the dimension stored in the vector column
      const columnDimension = await checkVectorDimension();
      const modelDimension = this.getModelDimension(model);
      if (
        columnDimension &&
        modelDimension &&
        modelDimension !== columnDimension
      ) {
        const fallback = this.getFallbackModelForDimension(columnDimension);
        if (fallback) {
          console.warn(
            `[RAG] Embedding model ${model} has dimension ${modelDimension}, but DB column is ${columnDimension}. Switching to ${fallback} to match stored embeddings.`,
          );
          model = fallback;
        } else {
          console.warn(
            `[RAG] Embedding model dimension ${modelDimension} does not match DB column dimension ${columnDimension}. Consider re-embedding your knowledge base or updating the model.`,
          );
        }
      }

      this.embeddingModel = model;
      console.log(`[RAG] Loaded embedding model: ${this.embeddingModel}`);
    } catch (error) {
      console.error(
        "[RAG] Error loading configuration, using defaults:",
        error,
      );
    }
  }

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
      const enhancedQuery = this.enhanceQueryForVietnameseTerms(sanitizedQuery);

      const [vectorResults, keywordResults] = await Promise.all([
        this.searchByVector(enhancedQuery, topK * 2),
        this.searchByKeywords(enhancedQuery, topK * 2),
      ]);

      let merged = this.mergeAndRankRRF(vectorResults, keywordResults, topK);

      console.log(
        `\n[RAG] 📋 Merged search found ${merged.length} relevant chunks:`,
      );
      merged.forEach((chunk, i) => {
        const source =
          chunk.metadata?.source || chunk.metadata?.content_url || "Unknown";
        const relevance = (chunk.similarity * 100).toFixed(1);
        console.log(
          `\n[RAG]   ─── Chunk ${i + 1} (Relevance Score: ${relevance}) ───`,
        );
        console.log(`[RAG]   Nguồn: ${source}`);
        console.log(
          `[RAG]   Nội dung:\n${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? "..." : ""}`,
        );
      });

      // ** NEW: Expand to full document context **
      if (merged.length > 0) {
        console.log("\n[RAG] 📚 Expanding to full document context...");
        const knowledgeBaseIds = [
          ...new Set(merged.map((c) => c.knowledge_base_id).filter(Boolean) as string[]),
        ];
        if (knowledgeBaseIds.length > 0) {
          const allChunksFromDocs = await getChunksByKnowledgeBaseId(knowledgeBaseIds);
          console.log(`[RAG]   Found ${allChunksFromDocs.length} total chunks from ${knowledgeBaseIds.length} documents.`);
          
          // Create a map for quick lookup
          const mergedMap = new Map(merged.map(c => [c.id, c]));
          // Combine and deduplicate
          const combined = [...merged];
          allChunksFromDocs.forEach(chunk => {
            if (!mergedMap.has(chunk.id)) {
              combined.push({ ...chunk, source: 'hybrid', similarity: 0 }); // Add similarity if not present
            }
          });
          merged = combined;
        }
      }

      const finalChunks = await reRankResults(this.hfClient, enhancedQuery, merged);

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

  private enhanceQueryForVietnameseTerms(query: string): string {
    const termMappings: { [key: string]: string[] } = {
      "tạm trú": ["tạm trú", "đăng ký tạm trú", "KT3", "khai báo tạm trú", "thủ tục tạm trú"],
      "tạm vắng": ["tạm vắng", "đăng ký tạm vắng", "giấy tạm vắng", "khai báo tạm vắng"],
      "thường trú": ["thường trú", "đăng ký thường trú", "hộ khẩu", "sổ hộ khẩu", "KT2"],
      "khai sinh": ["khai sinh", "giấy khai sinh", "đăng ký khai sinh"],
      "khai tử": ["khai tử", "giấy khai tử", "đăng ký khai tử"],
      "đăng ký kết hôn": ["kết hôn", "đăng ký kết hôn", "giấy chứng nhận kết hôn"],
      "ly hôn": ["ly hôn", "giải quyết ly hôn", "thủ tục ly hôn"],
      "cấp giấy phép": ["giấy phép", "cấp phép", "giấy phép xây dựng", "giấy phép kinh doanh"],
      "hành chính": ["hành chính", "thủ tục hành chính", "dịch vụ công", "cổng dịch vụ công"],
      "giấy tờ": ["giấy tờ", "hồ sơ", "thủ tục", "giấy phép"],
      "lệ phí": ["lệ phí", "phí", "tiền lệ phí", "thu phí"],
      "thời gian": ["thời gian", "thời hạn", "thủ tục", "giải quyết"],
      "nơi cư trú": ["nơi cư trú", "địa chỉ", "chỗ ở", "hộ khẩu"],
      "chứng minh": ["chứng minh", "xác nhận", "xác thực", "chứng thực"],
      "ủy quyền": ["ủy quyền", "ủy nhiệm", "ủy thác", "giấy ủy quyền"],
      "xác nhận": ["xác nhận", "xác thực", "chứng thực", "xác minh"],
    };

    let enhancedQuery = query.toLowerCase();
    for (const [mainTerm, relatedTerms] of Object.entries(termMappings)) {
      if (enhancedQuery.includes(mainTerm)) {
        relatedTerms.forEach((term) => {
          if (!enhancedQuery.includes(term)) {
            enhancedQuery += ` ${term}`;
          }
        });
      }
    }
    return enhancedQuery;
  }

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
      // Re-throwing the error to be caught by the main pipeline
      throw err;
    }
  }

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

  private mergeAndRankRRF(
    vectorResults: KnowledgeChunk[],
    keywordResults: KnowledgeChunk[],
    topK: number,
    k: number = 60, // RRF ranking constant
  ): KnowledgeChunk[] {
    const scores: { [id: string]: number } = {};
    const combinedResults: { [id: string]: KnowledgeChunk } = {};

    vectorResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      scores[result.id] = (scores[result.id] || 0) + rrfScore;
      if (!combinedResults[result.id]) {
        combinedResults[result.id] = { ...result, source: 'hybrid' };
      }
    });

    keywordResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      scores[result.id] = (scores[result.id] || 0) + rrfScore;
      if (!combinedResults[result.id]) {
        combinedResults[result.id] = { ...result, source: 'hybrid' };
      } else if (combinedResults[result.id].source !== 'vector') {
          combinedResults[result.id].similarity = result.similarity;
      }
    });

    const merged = Object.keys(scores)
      .map(id => {
        const chunk = combinedResults[id];
        chunk.similarity = scores[id];
        chunk.content = this.cleanText(chunk.content);
        return chunk;
      })
      .filter(chunk => chunk.similarity > 1 / (k + 100));

    return merged.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  // ** REFACTORED for simplicity and correctness **
  private async generateEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = embeddingCache.getCacheKey("embedding", { model: this.embeddingModel, text: text.substring(0, 200) });
    const cached = embeddingCache.get<number[]>(cacheKey);
    if (cached) {
      console.log("[RAG] Embedding cache hit.")
      return cached;
    }

    console.log(`[RAG] Generating embedding for text using model: ${this.embeddingModel}`);

    try {
       if (!this.embeddingModel) {
          throw new Error("Embedding model is not configured.");
      }

      const response = await this.hfClient.featureExtraction({
        model: this.embeddingModel,
        inputs: text,
      });

      // ** FIX for TypeScript build error **
      // Explicitly handle the two possible return types from featureExtraction
      let embedding: number[] | null = null;
      if (Array.isArray(response) && response.length > 0) {
        if (typeof response[0] === 'number') {
          embedding = response as number[];
        } else if (Array.isArray(response[0])) {
          embedding = response[0] as number[];
        }
      }

      if (!embedding) {
          throw new Error(`Invalid embedding response format. Expected an array of numbers. Received: ${JSON.stringify(response)}`);
      }

      console.log(`[RAG] ✅ Embedding generated with dimension: ${embedding.length}`);

      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (err) {
      console.error(`[RAG] ❌ Embedding generation failed for model ${this.embeddingModel}:`, err);
      return null;
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getModelDimension(model: string): number | null {
    const knownDims: Record<string, number> = {
      "BAAI/bge-small-en-v1.5": 384,
      "sentence-transformers/all-MiniLM-L6-v2": 384,
      "intfloat/multilingual-e5-small": 384,
      "BAAI/bge-base-en-v1.5": 768,
      "intfloat/multilingual-e5-base": 768,
      "BAAI/bge-large-en-v1.5": 1024,
      "Qwen/Qwen3-Embedding-8B": 4096,
    };
    return knownDims[model] ?? null;
  }

  private getFallbackModelForDimension(dimension: number): string | null {
    const fallbackByDim: Record<number, string> = {
      384: "BAAI/bge-small-en-v1.5",
      768: "BAAI/bge-base-en-v1.5",
      1024: "BAAI/bge-large-en-v1.5",
      4096: "Qwen/Qwen3-Embedding-8B",
    };
    return fallbackByDim[dimension] ?? null;
  }

  formatContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) return "";
    const urls = new Set<string>();
    chunks.forEach((chunk) => {
      if (chunk.metadata?.content_url?.trim()) {
        urls.add(chunk.metadata.content_url);
      }
      if (chunk.metadata?.source?.trim()) {
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
        const relevanceInfo = `\n(Độ liên quan: ${(chunk.similarity * 100).toFixed(1)}%)`;
        return `[TÀI LIỆU ${index + 1}]:\n${chunk.content}${sourceInfo}${relevanceInfo}\n`;
      })
      .join("\n")}${urlsText}=== HẾT THÔNG TIN TÌM THẤY ===`;
  }
}
