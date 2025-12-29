-- Update embedding model to Qwen3-Embedding-8B (1024 dimensions, multilingual)
-- This model supports Vietnamese better than English-only models

-- Step 1: Update model configuration
UPDATE ai_models
SET
    model_string = 'Qwen/Qwen3-Embedding-8B',
    name = 'Qwen3-Embedding-8B (Vietnamese Support)'
WHERE id = 'hf-embed-1';

-- Step 2: Drop old dimension constraint
ALTER TABLE knowledge_chunks
DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Step 3: Add new constraint to support 1024 dimensions
ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, '[\]\]', ''), ','), '\d+')::integer[]) IN (1024, 384));

-- Step 4: Verify
SELECT
    id,
    provider,
    name,
    model_string,
    is_active
FROM ai_models
WHERE id = 'hf-embed-1';
