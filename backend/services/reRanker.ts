/**
 * reRanker.ts
 * ------------------------------------
 * Cross-Encoder re-ranking for precision
 * ------------------------------------
 */
import { InferenceClient } from "@huggingface/inference";
import { KnowledgeChunk } from "./ragService.js";

export async function reRankResults(
  hfClient: InferenceClient,
  query: string,
  chunks: KnowledgeChunk[],
) {
  if (chunks.length === 0) return chunks;

  try {
    console.log(`[ReRanker] 🚀 Re-ranking ${chunks.length} chunks...`);

    // Skip re-ranking if there's only one chunk or if it's not beneficial
    if (chunks.length <= 1) {
      return chunks.sort((a, b) => b.similarity - a.similarity);
    }

    // For now, skip re-ranking entirely since the cross-encoder model is not available
    // This prevents the multiple API calls that result in provider errors
    console.log(`[ReRanker] 🔄 Skipping re-ranking (cross-encoder model unavailable)`);
    return chunks.sort((a, b) => b.similarity - a.similarity);
  } catch (err) {
    console.error("[ReRanker] ⚠️ Unexpected error during re-ranking:", err);
    // If there's a major error, return original chunks sorted by similarity
    return chunks.sort((a, b) => b.similarity - a.similarity);
  }
}
