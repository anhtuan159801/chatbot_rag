// Example code using Qwen3-Embedding-8B with Nebius provider
// This demonstrates how to use the new model in your application

import { InferenceClient } from "@huggingface/inference";

// Initialize the client with your API key
const client = new InferenceClient(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);

// Method 1: Generate embedding with specific provider
async function generateEmbedding(text, provider = 'nebius') {
  const output = await client.featureExtraction({
    model: "Qwen/Qwen3-Embedding-8B",
    inputs: text,
    provider: provider  // 'nebius' or 'auto'
  });

  console.log(`Generated embedding with ${output.length} dimensions`);
  return output;
}

// Method 2: Generate embedding (auto provider selection)
async function generateEmbeddingAuto(text) {
  const output = await client.featureExtraction({
    model: "Qwen/Qwen3-Embedding-8B",
    inputs: text
    // provider: 'auto' - HuggingFace will choose the best available provider
  });

  console.log(`Generated embedding with ${output.length} dimensions`);
  return output;
}

// Example usage
async function main() {
  const text = "Hướng dẫn đăng ký tạm trú";

  console.log("Generating embedding for Vietnamese text...");
  console.log(`Text: "${text}"\n`);

  // Using nebius provider (as in your example)
  const embedding = await generateEmbedding(text, 'nebius');

  console.log("\n✅ Embedding generated successfully!");
  console.log(`Length: ${embedding.length} dimensions`);
  console.log(`First 5 values: [${embedding.slice(0, 5).join(', ')}...]`);

  // You can now use this embedding for:
  // - Storing in PostgreSQL with pgvector
  // - Searching for similar documents
  // - Clustering documents
}

main().catch(console.error);
