import { Client } from 'pg';
import { InferenceClient } from '@huggingface/inference';
import pgClient from '../services/supabaseService.js';

interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: any;
}

/**
 * RAG Service - Retrieval Augmented Generation
 * Truy xuất knowledge base từ database và trả về các liên quan nhất
 */
export class RAGService {
  constructor() {
  }

  /**
   * Tìm kiếm relevant knowledge chunks dựa trên query
   */
  async searchKnowledge(query: string, topK: number = 3): Promise<KnowledgeChunk[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      // Check if knowledge_chunks table exists and has pgvector extension
      const tableExists = await this.checkTableExists('knowledge_chunks');

      if (!tableExists) {
        console.log('knowledge_chunks table not found, returning empty results');
        return [];
      }

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      if (!queryEmbedding) {
        console.error('Failed to generate embedding for query');
        return [];
      }

      // Search for similar chunks using cosine similarity
      const result = await pgClient?.query(
        `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) as similarity
         FROM knowledge_chunks
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [`[${queryEmbedding.join(',')}]`, topK]
      );

      if (!result) {
        return [];
      }

      if (result.rows.length === 0) {
        console.log('No relevant chunks found');
        return [];
      }

      return result.rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata
      }));

    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Generate embedding using configured model from database
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
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
        inputs: text
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

      return embedding;
    } catch (error: any) {
      console.error('Error generating embedding:', error.message);
      return null;
    }
  }

  /**
   * Check if table exists in database
   */
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

  /**
   * Format retrieved chunks into context for AI
   */
  formatContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) {
      return '';
    }

    return chunks.map((chunk, index) =>
      `[Kiến thức ${index + 1}]:\n${chunk.content}\n`
    ).join('\n');
  }
}

export const ragService = new RAGService();
