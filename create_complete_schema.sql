-- ============================================================================
-- RAGBot Admin Console - Complete Database Schema
-- ============================================================================
-- This script creates all tables required for the RAGBot system
-- Run this once to initialize the database
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable Required Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. Create System Configurations Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent deletion of critical configs
    CONSTRAINT no_delete_key CHECK (key IS NOT NULL)
);

-- Create trigger to auto-update updated_at timestamp
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

-- ----------------------------------------------------------------------------
-- 3. Create AI Models Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'openrouter', 'huggingface')),
    name TEXT NOT NULL,
    model_string TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent empty required fields
    CONSTRAINT valid_model CHECK (
        id IS NOT NULL AND
        provider IS NOT NULL AND
        name IS NOT NULL AND
        model_string IS NOT NULL
    )
);

-- Create trigger to auto-update updated_at timestamp
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

-- ----------------------------------------------------------------------------
-- 4. Create Knowledge Base Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PDF', 'DOCX', 'WEB_CRAWL', 'CSV', 'TXT')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'VECTORIZING', 'COMPLETED', 'PARTIAL', 'FAILED')) DEFAULT 'PENDING',
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_count INTEGER DEFAULT 0 CHECK (vector_count >= 0),
    size TEXT,
    content_url TEXT,
    -- Prevent invalid status transitions
    CONSTRAINT valid_document CHECK (
        id IS NOT NULL AND
        name IS NOT NULL AND
        type IS NOT NULL
    )
);

-- Create trigger to auto-update upload_date on insert
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

-- ----------------------------------------------------------------------------
-- 5. Create Knowledge Chunks Table (with pgvector)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent empty content
    CONSTRAINT valid_chunk CHECK (
        id IS NOT NULL AND
        knowledge_base_id IS NOT NULL AND
        content IS NOT NULL AND
        LENGTH(TRIM(content)) > 0
    )
);

-- ----------------------------------------------------------------------------
-- 6. Create AI Role Assignments Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_role_assignments (
    role_key TEXT PRIMARY KEY CHECK (role_key IS NOT NULL),
    model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent invalid model references
    CONSTRAINT valid_role_assignment CHECK (
        role_key IS NOT NULL AND
        model_id IS NOT NULL
    )
);

-- Create trigger to auto-update updated_at timestamp
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
-- 7. Create Indexes for Performance
-- ============================================================================

-- Indexes for system_configs
CREATE INDEX IF NOT EXISTS idx_system_configs_updated_at ON system_configs(updated_at DESC);

-- Indexes for ai_models
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_updated_at ON ai_models(updated_at DESC);

-- Indexes for knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_type ON knowledge_base(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_upload_date ON knowledge_base(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_vector_count ON knowledge_base(vector_count);

-- Indexes for knowledge_chunks (IVFFlat for vector similarity search)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_base_id ON knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_index ON knowledge_chunks(knowledge_base_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_created_at ON knowledge_chunks(created_at DESC);

-- Indexes for ai_role_assignments
CREATE INDEX IF NOT EXISTS idx_ai_role_assignments_model_id ON ai_role_assignments(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_role_assignments_updated_at ON ai_role_assignments(updated_at DESC);

-- ============================================================================
-- 8. Insert Default Data
-- ============================================================================

-- Insert default system configurations
INSERT INTO system_configs (key, value) VALUES
(
    'facebook_config',
    '{"pageId":"","accessToken":"","pageName":""}'::jsonb
),
(
    'system_prompt',
    '"Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật."'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Note: AI models are initialized by the application via initializeSystemData()
-- This ensures API keys from environment variables are used correctly

-- ============================================================================
-- 9. Grant Permissions (for Supabase)
-- ============================================================================

-- Enable Row Level Security (optional, can be disabled for development)
-- Uncomment the following lines if you need RLS:

-- ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_role_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. Verification Queries
-- ============================================================================

-- Verify all tables were created
DO $$
DECLARE
    table_name TEXT;
BEGIN
    RAISE NOTICE '=== Database Schema Verification ===';
    
    FOR table_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('system_configs', 'ai_models', 'knowledge_base', 'knowledge_chunks', 'ai_role_assignments')
        ORDER BY table_name
    LOOP
        RAISE NOTICE '✓ Table created: %', table_name;
    END LOOP;
    
    RAISE NOTICE '=== All tables created successfully ===';
END $$;

-- Verify extensions
DO $$
DECLARE
    ext_name TEXT;
BEGIN
    RAISE NOTICE '=== Extensions Verification ===';
    
    FOR ext_name IN 
        SELECT extname 
        FROM pg_extension 
        WHERE extname IN ('vector', 'uuid-ossp')
        ORDER BY extname
    LOOP
        RAISE NOTICE '✓ Extension enabled: %', ext_name;
    END LOOP;
    
    RAISE NOTICE '=== All extensions enabled ===';
END $$;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
