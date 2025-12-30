import { Client } from 'pg';
import { InferenceClient } from '@huggingface/inference';
import pgClient, { searchByKeywords, KnowledgeChunkResult } from '../services/supabaseService.js';

interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  source: 'vector' | 'keyword' | 'hybrid';
}

export class RAGService {
  private readonly VECTOR_WEIGHT = 0.7;
  private readonly KEYWORD_WEIGHT = 0.3;

  constructor() {}

  async searchKnowledge(query: string, topK: number = 3): Promise<KnowledgeChunk[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const tableExists = await this.checkTableExists('knowledge_chunks');

      if (!tableExists) {
        console.log('knowledge_chunks table not found, returning empty results');
        return [];
      }

      const { ragCache } = await import('./cacheService.js');
      const cacheKey = ragCache.getCacheKey('rag', { query: query.substring(0, 100), topK });
      const cached = ragCache.get<KnowledgeChunk[]>(cacheKey);

      if (cached) {
        console.log(`RAG cache hit for query: "${query.substring(0, 50)}..."`);
        return cached;
      }

      const startTime = Date.now();

      const [vectorResults, keywordResults] = await Promise.all([
        this.searchByVector(query, topK * 2),
        this.searchByKeywords(query, topK * 2),
      ]);

      const hybridResults = this.mergeResults(vectorResults, keywordResults, topK);

      const duration = Date.now() - startTime;
      console.log(
        `Hybrid search completed in ${duration}ms. Found ${hybridResults.length} chunks.`
      );

      ragCache.set(cacheKey, hybridResults, 300000);
      return hybridResults;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  private async searchByVector(query: string, topK: number): Promise<KnowledgeChunk[]> {
    const queryEmbedding = await this.generateEmbedding(query);

    if (!queryEmbedding) {
      console.error('Failed to generate embedding for query');
      return [];
    }

    const result = await pgClient?.query(
      `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) as similarity
       FROM knowledge_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [`[${queryEmbedding.join(',')}]`, topK]
    );

    if (!result || result.rows.length === 0) {
      return [];
    }

    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
      source: 'vector' as const,
    }));
  }

  private async searchByKeywords(query: string, topK: number): Promise<KnowledgeChunk[]> {
    const keywordResults = await searchByKeywords(query, topK);

    return keywordResults.map(r => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      similarity: r.similarity,
      source: 'keyword' as const,
    }));
  }

  private mergeResults(
    vectorResults: KnowledgeChunk[],
    keywordResults: KnowledgeChunk[],
    topK: number
  ): KnowledgeChunk[] {
    const mergedMap = new Map<string, KnowledgeChunk>();

    for (const result of vectorResults) {
      const weightedScore = result.similarity * this.VECTOR_WEIGHT;
      mergedMap.set(result.id, {
        ...result,
        similarity: weightedScore,
        source: 'hybrid',
      });
    }

    for (const result of keywordResults) {
      const existing = mergedMap.get(result.id);
      if (existing) {
        const hybridScore = result.similarity * this.KEYWORD_WEIGHT + existing.similarity;
        mergedMap.set(result.id, {
          ...existing,
          similarity: hybridScore,
        });
      } else {
        mergedMap.set(result.id, {
          ...result,
          similarity: result.similarity * this.KEYWORD_WEIGHT,
          source: 'hybrid',
        });
      }
    }

    return Array.from(mergedMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const { embeddingCache } = await import('./cacheService.js');
      const cacheKey = embeddingCache.getCacheKey('embedding', { text: text.substring(0, 200) });
      const cached = embeddingCache.get<number[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const { getAiRoles, getModels } = await import('./supabaseService.js');

      const roles = await getAiRoles();
      const ragModelId = roles.rag;
      const models = await getModels();
      const embeddingModel = models.find(m => m.id === ragModelId);

      let apiKey = '';
      let modelName = 'BAAI/bge-small-en-v1.5';

      if (embeddingModel && embeddingModel.api_key) {
        apiKey = embeddingModel.api_key;
      } else {
        apiKey = process.env.HUGGINGFACE_API_KEY || '';
      }

      if (!apiKey) {
        console.warn('No API key available, returning null embedding');
        return null;
      }

      if (embeddingModel && embeddingModel.model_string) {
        modelName = embeddingModel.model_string;
        console.log(`Using embedding model: ${modelName}`);
      } else {
        console.log('Using default embedding model: BAAI/bge-small-en-v1.5');
      }

      const client = new InferenceClient(apiKey);
      const result = await client.featureExtraction({
        model: modelName,
        inputs: text,
      });

      let embedding: number[] | null = null;

      if (typeof result === 'number') {
        embedding = [result];
        console.log(`Generated embedding using HuggingFace (single value)`);
      } else if (Array.isArray(result) && result.length > 0) {
        if (typeof result[0] === 'number') {
          embedding = result as number[];
          console.log(`Generated embedding using HuggingFace (${result.length} dimensions)`);
        } else if (Array.isArray(result[0])) {
          embedding = result[0] as number[];
          console.log(`Generated embedding using HuggingFace (${result[0].length} dimensions)`);
        }
      }

      if (!embedding) {
        console.error('Invalid embedding format from HuggingFace API');
        return null;
      }

      embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error: any) {
      console.error('Error generating embedding:', error.message);
      return null;
    }
  }

  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      if (!pgClient) return false;

      const result = await pgClient.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'public'
           AND table_name = $1
        )`,
        [tableName]
      );

      return result.rows[0].exists;
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  }

  formatContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    return chunks.map((chunk, index) => `[Kiến thức ${index + 1}]:\n${chunk.content}\n`).join('\n');
  }
}

export const ragService = new RAGService();
