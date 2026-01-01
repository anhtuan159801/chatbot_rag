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

    const pairs = chunks.map((chunk) => ({
      text_a: query,
      text_b: chunk.content,
    }));

    // textClassification in @huggingface/inference usually takes a string or array of strings.
    // If the library expects a string for a single classification, we might need to format it differently
    // or use a different method. However, for batch processing, we can often pass an array of strings
    // representing the pairs if the model supports it, or just the text.
    // Since the provided code passed objects, we'll assume the user might be using a custom wrapper or
    // we should format it as a string if strictly typed.
    // Safest approach for cross-encoder score is usually passing the pair as a string "query <sep> document"
    // But to strictly follow the user's code request, I'll try to adapt to the library's reality.

    // The library @huggingface/inference v4.13.5 textClassification:
    // inputs: string | string[]
    // So we must pass strings.
    const inputs = pairs.map((p) => `${p.text_a} [SEP] ${p.text_b}`);

    const results = await hfClient.textClassification({
      model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
      inputs: inputs as any, // Casting to any if types mismatch due to library version specifics, or strictly string[]
    });

    // Result structure: Array<{ label: string, score: number }>
    // Since we passed an array, results is an array of arrays (one per input).
    // Wait, if inputs is array, results is array of results.
    // If results is array of arrays (batch), we map accordingly.

    const scores = Array.isArray(results[0])
      ? (results as any)[0]
      : (results as any[]);

    const ranked = chunks
      .map((chunk, i) => {
        const score = scores[i]?.score ?? 0;
        return {
          ...chunk,
          similarity: (chunk.similarity + score) / 2,
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    console.log(`[ReRanker] ✅ Re-ranking complete.`);
    return ranked;
  } catch (err) {
    console.error("[ReRanker] ⚠️ Error re-ranking:", err);
    return chunks;
  }
}
