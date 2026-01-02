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

    // Try to use cross-encoder model for re-ranking
    const pairs = chunks.map((chunk) => ({
      text_a: query,
      text_b: chunk.content,
    }));

    // Cross-encoder models typically work differently - they expect pairs of text
    // For batch processing, we need to handle this differently
    // Let's process each pair individually to avoid issues with the API
    const ranked = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const input = `${query} [SEP] ${chunk.content}`;

      try {
        const result = await hfClient.textClassification({
          model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
          inputs: input,
        });

        // Extract score from the result - textClassification returns different structures
        let score = 0;
        if (Array.isArray(result) && result[0]) {
          // If result is an array of classification results, take the first one
          const firstResult = result[0];
          // The result typically has label and score properties
          score = typeof firstResult === 'object' && 'score' in firstResult ? firstResult.score : 0;
        } else if (Array.isArray(result)) {
          // If it's a simple array, try to get the score from the first element
          score = result.length > 0 && typeof result[0] === 'object' && 'score' in result[0]
            ? result[0].score
            : 0;
        }

        ranked.push({
          ...chunk,
          similarity: (chunk.similarity + score) / 2,
        });
      } catch (singleError: any) {
        console.warn(`[ReRanker] ⚠️ Single item re-ranking failed for chunk ${i}:`, singleError.message);
        // If individual re-ranking fails, keep the original chunk with its similarity
        ranked.push(chunk);
      }
    }

    // Sort by similarity
    ranked.sort((a, b) => b.similarity - a.similarity);

    console.log(`[ReRanker] ✅ Re-ranking complete.`);
    return ranked;
  } catch (err) {
    console.error("[ReRanker] ⚠️ Unexpected error during re-ranking:", err);
    // If there's a major error, return original chunks sorted by similarity
    return chunks.sort((a, b) => b.similarity - a.similarity);
  }
}
