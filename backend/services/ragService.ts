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
  private readonly VECTOR_WEIGHT = 0.7;
  private readonly KEYWORD_WEIGHT = 0.3;
  private readonly MIN_SIMILARITY = parseFloat(process.env.MIN_SIMILARITY || '0.3'); // Lower threshold for better recall
  private readonly CACHE_TTL = 300_000; // 5 minutes
  private hfClient: InferenceClient;

  constructor(hfClient: InferenceClient) {
    this.hfClient = hfClient;
  }

  /**
   * Hybrid Search: semantic + keyword
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

      // Perform hybrid search
      const [vectorResults, keywordResults] = await Promise.allSettled([
        this.searchByVector(query, topK * 2),
        this.searchByKeywords(query, topK * 2),
      ]);

      const safeVector =
        vectorResults.status === "fulfilled" ? vectorResults.value : [];
      const safeKeyword =
        keywordResults.status === "fulfilled" ? keywordResults.value : [];

      const merged = this.mergeAndRank(safeVector, safeKeyword, topK);

      // Optional Re-ranking
      const ranked = await reRankResults(this.hfClient, query, merged);

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
        (item.source === "vector" ? this.VECTOR_WEIGHT : 0) * item.similarity +
        (item.source === "keyword" ? this.KEYWORD_WEIGHT : 0) * item.similarity;

      // Only add items that meet the minimum similarity threshold
      if (score >= this.MIN_SIMILARITY) {
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
