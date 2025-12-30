-- ============================================================================
-- Schema Migration: Create Complete Database Schema
-- ============================================================================
-- Author: System
-- Date: 2025-01-02
-- Description: Initial complete database schema creation
-- ============================================================================

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create System Configurations Table
CREATE TABLE IF NOT EXISTS system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_delete_key CHECK (key IS NOT NULL)
);

CREATE OR REPLACE FUNCTION update_system_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_configs_timestamp
    BEFORE UPDATE ON system_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_system_configs_timestamp();

-- Create AI Models Table
CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'openrouter', 'huggingface')),
    name TEXT NOT NULL,
    model_string TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_model CHECK (
        id IS NOT NULL AND
        provider IS NOT NULL AND
        name IS NOT NULL AND
        model_string IS NOT NULL
    )
);

CREATE OR REPLACE FUNCTION update_ai_models_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_models_timestamp
    BEFORE UPDATE ON ai_models
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_models_timestamp();

-- Create Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PDF', 'DOCX', 'WEB_CRAWL', 'CSV', 'TXT')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'VECTORIZING', 'COMPLETED', 'PARTIAL', 'FAILED')) DEFAULT 'PENDING',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_count INTEGER DEFAULT 0 CHECK (vector_count >= 0),
    size TEXT,
    content_url TEXT,
    CONSTRAINT valid_document CHECK (
        id IS NOT NULL AND
        name IS NOT NULL AND
        type IS NOT NULL
    )
);

CREATE OR REPLACE FUNCTION update_knowledge_base_upload_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.upload_date IS NULL THEN
        NEW.upload_date = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_base_upload_date
    BEFORE INSERT ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_upload_date();

-- Create Knowledge Chunks Table
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_chunk CHECK (
        id IS NOT NULL AND
        knowledge_base_id IS NOT NULL AND
        content IS NOT NULL AND
        LENGTH(TRIM(content)) > 0
    )
);

-- Create AI Role Assignments Table
CREATE TABLE IF NOT EXISTS ai_role_assignments (
    role_key TEXT PRIMARY KEY CHECK (role_key IS NOT NULL),
    model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_role_assignment CHECK (
        role_key IS NOT NULL AND
        model_id IS NOT NULL
    )
);

CREATE OR REPLACE FUNCTION update_ai_role_assignments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_role_assignments_timestamp
    BEFORE UPDATE ON ai_role_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_role_assignments_timestamp();

-- ============================================================================
-- Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_system_configs_updated_at ON system_configs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_updated_at ON ai_models(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_type ON knowledge_base(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_upload_date ON knowledge_base(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_vector_count ON knowledge_base(vector_count);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_base_id ON knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_index ON knowledge_chunks(knowledge_base_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_created_at ON knowledge_chunks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_role_assignments_model_id ON ai_role_assignments(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_assignments_updated_at ON ai_role_assignments(updated_at DESC);

-- ============================================================================
-- Insert Default Data
-- ============================================================================

INSERT INTO system_configs (key, value) VALUES
    ('facebook_config', '{"pageId":"","accessToken":"","pageName":""}'::jsonb),
    ('system_prompt', '"Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật."'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP TABLE IF EXISTS ai_role_assignments CASCADE;
-- DROP TABLE IF EXISTS knowledge_chunks CASCADE;
-- DROP TABLE IF EXISTS knowledge_base CASCADE;
-- DROP TABLE IF EXISTS ai_models CASCADE;
-- DROP TABLE IF EXISTS system_configs CASCADE;
-- DROP EXTENSION IF EXISTS vector CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
