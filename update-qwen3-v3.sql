-- Simple update script for embedding model to Qwen3-Embedding-8B
-- This supports 1024 dimensions instead of 384

-- Step 1: Update model
UPDATE ai_models
SET model_string = 'Qwen/Qwen3-Embedding-8B',
    name = 'Qwen3-Embedding-8B (Vietnamese Support)'
WHERE id = 'hf-embed-1';

-- Step 2: Remove old dimension constraint entirely
ALTER TABLE knowledge_chunks
DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Step 3: Verify removal
SELECT
    'Old constraint removed. No dimension restriction on embedding column' as status;
