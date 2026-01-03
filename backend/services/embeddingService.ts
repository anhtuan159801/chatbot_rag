/**
 * embeddingService.ts
 * -------------------------------------
 * Shared embedding service to eliminate duplication
 * -------------------------------------
 */
import { InferenceClient } from "@huggingface/inference";
import { embeddingCache } from "./cacheService.js";

export interface EmbeddingModelConfig {
  id: string;
  provider: string;
  name: string;
  model_string: string;
  api_key?: string;
  is_active: boolean;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private hfClient: InferenceClient | null = null;
  private apiKey: string = "";
  private defaultModel: string = "BAAI/bge-small-en-v1.5";
  private modelConfig: EmbeddingModelConfig | null = null;

  private constructor() {
    this.initialize();
  }

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  private async initialize() {
    this.apiKey =
      process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "";

    if (this.apiKey) {
      this.hfClient = new InferenceClient(this.apiKey);
    } else {
      console.warn("[EmbeddingService] No HUGGINGFACE_API_KEY configured");
    }

    const modelEnv = process.env.EMBEDDING_MODEL;
    if (modelEnv) {
      this.defaultModel = modelEnv;
    }
  }

  setModelConfig(config: EmbeddingModelConfig | null) {
    this.modelConfig = config;
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.warn("[EmbeddingService] Empty or invalid text provided");
      return null;
    }

    const trimmedText = text.trim().substring(0, 10000);

    const cacheKey = embeddingCache.getCacheKey("embedding", {
      text: trimmedText.substring(0, 200),
    });

    const cached = embeddingCache.get<number[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const client = this.getClient();
      const model = this.getModelName();

      const response = await client.featureExtraction({
        model,
        inputs: trimmedText,
      });

      const emb = Array.isArray(response[0]) ? response[0] : response;
      const embedding = emb as number[];

      if (embedding.length === 0) {
        console.error("[EmbeddingService] Empty embedding returned");
        return null;
      }

      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error: any) {
      console.error(
        "[EmbeddingService] Failed to generate embedding:",
        error.message,
      );
      return null;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    const results = await Promise.allSettled(
      texts.map((text) => this.generateEmbedding(text)),
    );

    return results.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );
  }

  private getClient(): InferenceClient {
    if (this.hfClient) {
      return this.hfClient;
    }

    const apiKey = this.modelConfig?.api_key || this.apiKey;
    if (!apiKey) {
      throw new Error("No API key available for embedding generation");
    }

    this.hfClient = new InferenceClient(apiKey);
    return this.hfClient;
  }

  private getModelName(): string {
    if (this.modelConfig?.model_string) {
      return this.modelConfig.model_string;
    }
    return this.defaultModel;
  }

  async getEmbeddingDimension(): Promise<number> {
    const testEmbedding = await this.generateEmbedding("test");
    return testEmbedding?.length || 0;
  }

  reset() {
    this.modelConfig = null;
  }
}

export const embeddingService = EmbeddingService.getInstance();
