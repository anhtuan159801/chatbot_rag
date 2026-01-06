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
  checkVectorDimension,
  getAiRoles,
  getModels,
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
  private vectorWeight: number = 0.5; // Default, consider if still needed after RRF
  private keywordWeight: number = 0.5; // Default, consider if still needed after RRF
  private minSimilarity: number = 0.1;

  constructor(hfClient: InferenceClient) {
    this.hfClient = hfClient;
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
    }
  }

  private async getEmbeddingModelConfig(): Promise<string> {
    try {
      const { getRagConfig } = await import("./supabaseService.js");
      const config = await getRagConfig();
      return config.embeddingModel || "BAAI/bge-small-en-v1.5";
    } catch (error) {
      return process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5";
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
      const dim = await checkVectorDimension("knowledge_chunks", "embedding");
      if (dim && dim !== 384 && dim !== 1024)
        console.warn(
          `[RAG] ⚠️ Vector dimension mismatch (DB=${dim}, expected=384 or 1024)`,
        );

      const enhancedQuery = this.enhanceQueryForVietnameseTerms(sanitizedQuery);

      const [vectorResults, keywordResults] = await Promise.all([
        this.searchByVector(enhancedQuery, topK * 2),
        this.searchByKeywords(enhancedQuery, topK * 2),
      ]);

      // ** REFACTORED: Use Reciprocal Rank Fusion (RRF) for merging **
      const merged = this.mergeAndRankRRF(vectorResults, keywordResults, topK);

      console.log(
        `\n[RAG] 📋 Merged search found ${merged.length} relevant chunks:`,
      );
      merged.forEach((chunk, i) => {
        const source =
          chunk.metadata?.source || chunk.metadata?.content_url || "Unknown";
        // RRF score is not a direct similarity, so we can label it as "relevance"
        const relevance = (chunk.similarity * 100).toFixed(1);
        console.log(
          `\n[RAG]   ─── Chunk ${i + 1} (Relevance Score: ${relevance}) ───`,
        );
        console.log(`[RAG]   Nguồn: ${source}`);
        console.log(
          `[RAG]   Nội dung:\n${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? "..." : ""}`,
        );
      });
      
      // ** REFACTORED: Re-ranking is now the final step before returning **
      // The re-ranker is currently disabled, but if enabled, it would process `merged` results.
      const finalChunks = await reRankResults(this.hfClient, enhancedQuery, merged);

      // ** REMOVED: The problematic logic that fetched all chunks from a document **
      // This was the primary source of context noise. The system now relies only on
      // the most relevant chunks identified by the hybrid search.

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
      return [];
    }
  }

  private async searchByKeywords(query: string, topK: number) {
    console.log(`[RAG] 🔑 Keyword search...`);
    try {
      const results = await searchByKeywords(query, topK);
      // ** Note: `searchByKeywords` from supabaseService returns a constant similarity.
      // RRF merger handles this gracefully by relying on rank instead of score.
      return results.map((r) => ({
        ...r,
        source: "keyword" as const,
      }));
    } catch (err) {
      console.error("[RAG] ❌ Keyword search failed:", err);
      return [];
    }
  }

  /**
   * ** NEW: Merge results using Reciprocal Rank Fusion (RRF) **
   * This method is more robust than weighted sums when dealing with
   * scores from different, un-normalized systems.
   */
  private mergeAndRankRRF(
    vectorResults: KnowledgeChunk[],
    keywordResults: KnowledgeChunk[],
    topK: number,
    k: number = 60, // RRF ranking constant
  ): KnowledgeChunk[] {
    const scores: { [id: string]: number } = {};
    const combinedResults: { [id: string]: KnowledgeChunk } = {};

    // Calculate RRF scores from vector results
    vectorResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      scores[result.id] = (scores[result.id] || 0) + rrfScore;
      if (!combinedResults[result.id]) {
        combinedResults[result.id] = { ...result, source: 'hybrid' };
      }
    });

    // Calculate RRF scores from keyword results
    keywordResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1 / (k + rank);
      scores[result.id] = (scores[result.id] || 0) + rrfScore;
      if (!combinedResults[result.id]) {
        combinedResults[result.id] = { ...result, source: 'hybrid' };
      }
      // Since keyword search might not provide a meaningful similarity,
      // we ensure the vector one is used if available.
      else if (combinedResults[result.id].source !== 'vector') {
          combinedResults[result.id].similarity = result.similarity;
      }
    });

    const merged = Object.keys(scores)
      .map(id => {
        const chunk = combinedResults[id];
        // The new 'similarity' is the RRF score. It's not a true similarity
        // but a relevance score.
        chunk.similarity = scores[id]; 
        chunk.content = this.cleanText(chunk.content);
        return chunk;
      })
      // Filter out results with very low relevance
      .filter(chunk => chunk.similarity > 1 / (k + 100)); // Keep chunks that ranked within the top ~100

    // Sort by the new RRF score in descending order
    return merged.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = embeddingCache.getCacheKey("embedding", {
      text: text.substring(0, 200),
    });
    const cached = embeddingCache.get<number[]>(cacheKey);
    if (cached) return cached;

    try {
      let modelName = await this.getEmbeddingModelConfig();
      if (!modelName || modelName === "BAAI/bge-small-en-v1.5") {
        try {
          const roles = await getAiRoles();
          const ragModelId = roles.rag;
          const models = await getModels();
          const embeddingModel = models.find((m) => m.id === ragModelId);
          if (embeddingModel?.model_string) {
            modelName = embeddingModel.model_string;
          }
        } catch (e) {}
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

  private cleanText(text: string): string {
    return text
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();
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
        // The score is now an RRF score, so we can call it "Relevance"
        const relevanceInfo = `\n(Độ liên quan: ${(chunk.similarity * 100).toFixed(1)}%)`;
        return `[TÀI LIỆU ${index + 1}]:\n${chunk.content}${sourceInfo}${relevanceInfo}\n`;
      })
      .join("\n")}${urlsText}=== HẾT THÔNG TIN TÌM THẤY ===`;
  }
}
