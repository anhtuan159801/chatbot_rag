export interface KnowledgeChunk {
  id: string;
  knowledge_base_id: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any>;
  chunk_index: number;
  created_at: string;
}

export interface KnowledgeBaseDocument {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'WEB_CRAWL' | 'CSV' | 'TXT';
  status: 'PENDING' | 'PROCESSING' | 'VECTORIZING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  upload_date: string;
  vector_count: number;
  size: string;
  content_url: string;
}

export interface AIModel {
  id: string;
  provider: 'gemini' | 'openai' | 'openrouter' | 'huggingface';
  name: string;
  model_string: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIRoleAssignment {
  role_key: string;
  model_id: string;
  updated_at: string;
}

export interface SystemConfig {
  key: string;
  value: any;
  updated_at: string;
}

export interface HybridSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  keyword_score?: number;
  final_score: number;
  source: 'vector' | 'keyword' | 'hybrid';
}
