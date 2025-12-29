-- This script updates the embedding model to Qwen3-Embedding-8B (1024 dimensions)
-- Then drops and recreates the dimension constraint to support both 1024 and 384
-- Run with: node update-qwen3-v2.mjs

-- Step 1: Update model
UPDATE ai_models
SET model_string = 'Qwen/Qwen3-Embedding-8B',
    name = 'Qwen3-Embedding-8B (Vietnamese Support)'
WHERE id = 'hf-embed-1';

-- Step 2: Drop old constraint
ALTER TABLE knowledge_chunks
DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Step 3: Add new constraint (supports 1024 or 384 dimensions)
-- Note: We need to escape backslash properly for the regex
ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding, E'[\\[\\]]', E''), E','), E'\\d+')::integer[]) IN (1024, 384));
