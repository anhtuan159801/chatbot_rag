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
  private openaiApiKey: string;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
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
   * Generate embedding using HuggingFace API (default) or OpenAI API
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      // Try OpenAI first if API key is available
      if (this.openaiApiKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: text
            })
          });

          const data = await response.json();

          if (response.ok && data.data && Array.isArray(data.data)) {
            console.log('Generated embedding using OpenAI (1536 dimensions)');
            return data.data[0].embedding;
          } else {
            console.warn('OpenAI API error:', data);
          }
        } catch (openaiError) {
          console.warn('OpenAI embedding failed, trying HuggingFace fallback:', openaiError);
        }
      }

      // Fallback to HuggingFace
      const apiKey = process.env.HUGGINGFACE_API_KEY;
      if (!apiKey) {
        console.warn('No API keys available, returning null embedding');
        return null;
      }

      const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5', {
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
        console.log('Generated embedding using HuggingFace (384 dimensions)');
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
