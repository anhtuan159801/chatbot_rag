import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || '',
      embeddingModel: process.env.EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
    },
    embedding: {
      provider: process.env.EMBEDDING_PROVIDER || 'huggingface',
      model: process.env.EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5',
    },
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID || '',
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
    pageName: process.env.FACEBOOK_PAGE_NAME || '',
    verifyToken: process.env.FB_VERIFY_TOKEN || 'default-token',
  },
  cache: {
    embeddingTTL: parseInt(process.env.CACHE_TTL || '3600000', 10),
    queryTTL: parseInt(process.env.QUERY_CACHE_TTL || '300000', 10),
    ragTTL: parseInt(process.env.RAG_CACHE_TTL || '600000', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || '900000', 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
    ragWindowMs: parseInt(process.env.RATE_LIMIT_RAG_WINDOW || '900000', 10),
    ragMax: parseInt(process.env.RATE_LIMIT_RAG_MAX || '50', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  rag: {
    vectorWeight: parseFloat(process.env.RAG_VECTOR_WEIGHT || '0.7'),
    keywordWeight: parseFloat(process.env.RAG_KEYWORD_WEIGHT || '0.3'),
    defaultTopK: parseInt(process.env.RAG_DEFAULT_TOP_K || '3', 10),
  },
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.ai.huggingface.apiKey && !config.ai.openai.apiKey) {
    errors.push('At least one AI API key is required (HUGGINGFACE_API_KEY or OPENAI_API_KEY)');
  }

  if (config.auth.jwtSecret === 'change-me-in-production') {
    errors.push('JWT_SECRET must be changed in production');
  }

  if (!config.server.port) {
    errors.push('PORT must be a valid number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
