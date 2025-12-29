-- Update embedding model to multilingual model for better Vietnamese support
-- This script updates the RAG embedding model from BAAI/bge-small-en-v1.5 to intfloat/multilingual-e5-large

UPDATE ai_models
SET
    model_string = 'intfloat/multilingual-e5-large',
    name = 'E5 Multilingual Large (Vietnamese Support)'
WHERE id = 'hf-embed-1';

-- Verify the update
SELECT
    id,
    provider,
    name,
    model_string,
    is_active
FROM ai_models
WHERE id = 'hf-embed-1';
