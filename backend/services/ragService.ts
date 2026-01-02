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
} from "./supabaseService.js";
import { reRankResults } from "./reRanker.js";
import { ragCache, embeddingCache } from "./cacheService.js";

export interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  source: "vector" | "keyword" | "hybrid";
}

export class RAGService {
  private readonly CACHE_TTL = 300_000; // 5 minutes
  private hfClient: InferenceClient;
  private vectorWeight: number = 0.7;
  private keywordWeight: number = 0.3;
  private minSimilarity: number = 0.3;

  constructor(hfClient: InferenceClient) {
    this.hfClient = hfClient;
    // Initialize with default values, will be updated when needed
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const { getRagConfig } = await import('./supabaseService.js');
      const config = await getRagConfig();
      this.vectorWeight = config.vectorWeight;
      this.keywordWeight = config.keywordWeight;
      this.minSimilarity = config.minSimilarity;
    } catch (error) {
      console.error("[RAG] Error loading configuration, using defaults:", error);
      // Keep default values if config loading fails
    }
  }

  /**
   * Enhanced Hybrid Search: semantic + keyword with Vietnamese administrative term handling
   */
  async searchKnowledge(
    query: string,
    topK: number = 5,
  ): Promise<KnowledgeChunk[]> {
    console.log(`\n[RAG] 🔍 Search query: "${query}"`);
    if (!query?.trim()) {
      console.warn("[RAG] ⚠️ Empty query received.");
      return [];
    }

    // Reload configuration to ensure we have the latest values
    await this.loadConfig();

    const cacheKey = ragCache.getCacheKey("rag", { query, topK });
    const cached = ragCache.get<KnowledgeChunk[]>(cacheKey);
    if (cached) {
      console.log("[RAG] ✅ Cache hit.");
      return cached;
    }

    const start = Date.now();
    try {
      // Check dimension integrity
      const dim = await checkVectorDimension(
        "knowledge_chunks",
        "embedding",
      );
      if (dim && dim !== 384)
        console.warn(
          `[RAG] ⚠️ Vector dimension mismatch (DB=${dim}, expected=384)`,
        );

      // Enhanced query processing for Vietnamese administrative terms
      const enhancedQuery = this.enhanceQueryForVietnameseTerms(query);

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

      // Optional Re-ranking
      const ranked = await reRankResults(this.hfClient, enhancedQuery, merged);

      ragCache.set(cacheKey, ranked, this.CACHE_TTL);
      const ms = Date.now() - start;
      console.log(
        `[RAG] ✅ Completed hybrid search (${ranked.length} results in ${ms}ms)`,
      );

      return ranked;
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
      'tạm trú': ['tạm trú', 'đăng ký tạm trú', 'KT3', 'khai báo tạm trú', 'thủ tục tạm trú'],
      'tạm vắng': ['tạm vắng', 'đăng ký tạm vắng', 'giấy tạm vắng', 'khai báo tạm vắng'],
      'thường trú': ['thường trú', 'đăng ký thường trú', 'hộ khẩu', 'sổ hộ khẩu', 'KT2'],
      'khai sinh': ['khai sinh', 'giấy khai sinh', 'đăng ký khai sinh'],
      'khai tử': ['khai tử', 'giấy khai tử', 'đăng ký khai tử'],
      'đăng ký kết hôn': ['kết hôn', 'đăng ký kết hôn', 'giấy chứng nhận kết hôn'],
      'ly hôn': ['ly hôn', 'giải quyết ly hôn', 'thủ tục ly hôn'],
      'cấp giấy phép': ['giấy phép', 'cấp phép', 'giấy phép xây dựng', 'giấy phép kinh doanh'],
      'hành chính': ['hành chính', 'thủ tục hành chính', 'dịch vụ công', 'cổng dịch vụ công'],
      'giấy tờ': ['giấy tờ', 'hồ sơ', 'thủ tục', 'giấy phép'],
      'lệ phí': ['lệ phí', 'phí', 'tiền lệ phí', 'thu phí'],
      'thời gian': ['thời gian', 'thời hạn', 'thủ tục', 'giải quyết'],
      'nơi cư trú': ['nơi cư trú', 'địa chỉ', 'chỗ ở', 'hộ khẩu'],
      'chứng minh': ['chứng minh', 'xác nhận', 'xác thực', 'chứng thực'],
      'ủy quyền': ['ủy quyền', 'ủy nhiệm', 'ủy thác', 'giấy ủy quyền'],
      'xác nhận': ['xác nhận', 'xác thực', 'chứng thực', 'xác minh'],
    };

    let enhancedQuery = query.toLowerCase();

    // Expand query with related terms
    for (const [mainTerm, relatedTerms] of Object.entries(termMappings)) {
      if (enhancedQuery.includes(mainTerm)) {
        // Add related terms to the query for better matching
        relatedTerms.forEach(term => {
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
      const roles = await getAiRoles();
      const ragModelId = roles.rag;
      const models = await getModels();
      const embeddingModel = models.find((m) => m.id === ragModelId);

      let modelName = "BAAI/bge-small-en-v1.5";
      if (
        embeddingModel?.model_string &&
        embeddingModel.model_string.includes("bge")
      ) {
        modelName = embeddingModel.model_string;
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
    return chunks
      .map((chunk, index) => {
        const sourceUrl =
          chunk.metadata?.content_url || chunk.metadata?.source || "";
        const sourceInfo = sourceUrl ? `\nNguồn: ${sourceUrl}` : "";
        return `[Kiến thức ${index + 1}]:\n${chunk.content}${sourceInfo}\n`;
      })
      .join("\n");
  }
}
