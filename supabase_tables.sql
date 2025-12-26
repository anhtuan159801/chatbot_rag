-- SQL script to create tables for RAGBot Admin Console

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing system configurations (Facebook API, System Prompt, etc.)
CREATE TABLE IF NOT EXISTS system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing AI model configurations
CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    model_string TEXT NOT NULL,
    api_key TEXT, -- This should be encrypted in production
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing knowledge base information
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('PDF', 'DOCX', 'WEB_CRAWL', 'CSV')) NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'VECTORIZING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_count INTEGER DEFAULT 0,
    size TEXT,
    content_url TEXT
);

-- Table for storing knowledge chunks with embeddings (RAG)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_base_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing AI role assignments
CREATE TABLE IF NOT EXISTS ai_role_assignments (
    role_key TEXT PRIMARY KEY,
    model_id TEXT REFERENCES ai_models(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_configs_updated_at ON system_configs(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_upload_date ON knowledge_base(upload_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_base_id ON knowledge_chunks(knowledge_base_id);

-- Enable Row Level Security (RLS) for security (optional, can be configured based on your needs)
-- This would require additional policies based on your authentication method
-- ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_role_assignments ENABLE ROW LEVEL SECURITY;
