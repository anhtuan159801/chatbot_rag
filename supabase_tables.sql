-- SQL script to create tables for the RAGBot Admin Console

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

-- Enable Row Level Security (RLS) for security (optional, can be configured based on your needs)
-- This would require additional policies based on your authentication method
-- ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_role_assignments ENABLE ROW LEVEL SECURITY;

-- Insert default system configurations (these will be handled by the application)
-- INSERT INTO system_configs (key, value) VALUES 
-- ('facebook_config', '{"pageId": "", "accessToken": "", "pageName": ""}') 
-- ON CONFLICT (key) DO NOTHING;

-- Insert default AI models (these will be handled by the application)
-- INSERT INTO ai_models (id, provider, name, model_string, api_key, is_active) VALUES 
-- ('gemini-1', 'gemini', 'Google Gemini', 'gemini-3-flash-preview', '', true),
-- ('openai-1', 'openai', 'OpenAI', 'gpt-4o', '', false),
-- ('openrouter-1', 'openrouter', 'OpenRouter', 'openai/whisper-large-v3', '', false),
-- ('hf-1', 'huggingface', 'Hugging Face', 'xiaomi/mimo-v2-flash:free', '', false)
-- ON CONFLICT (id) DO NOTHING;

-- Insert default AI role assignments (these will be handled by the application)
-- INSERT INTO ai_role_assignments (role_key, model_id) VALUES 
-- ('chatbotText', 'gemini-1'),
-- ('chatbotVision', 'gemini-1'),
-- ('chatbotAudio', 'gemini-1'),
-- ('rag', 'openai-1'),
-- ('analysis', 'gemini-1'),
-- ('sentiment', 'hf-1')
-- ON CONFLICT (role_key) DO NOTHING;