import { Client } from 'pg';
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
      let apiUrl = '';
      let embeddingSize = 768;

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
        apiUrl = `https://router.huggingface.co/hf-inference/models/${embeddingModel.model_string}/pipeline/feature-extraction`;
        console.log(`Using embedding model: ${embeddingModel.model_string}`);
      } else {
        apiUrl = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/pipeline/feature-extraction';
        console.log('Using default embedding model: BAAI/bge-small-en-v1.5');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputs: text
        })
      });

      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        console.log(`Generated embedding using HuggingFace (${data[0].length} dimensions)`);
        return data[0];
      } else {
        console.error('HuggingFace API error:', data);
        return null;
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
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
