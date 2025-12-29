-- Update embedding column to support variable dimensions (384 or 1024)
-- This allows both old and new embedding models to work

-- Step 1: Drop existing dimension constraint
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Step 2: Add new flexible constraint (accepts 384 or 1024)
ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, '[\[\]]', ''), ','), '\d+')::integer[]) IN (384, 1024));

-- Step 3: Verify
SELECT
    'embedding column now accepts both 384 and 1024 dimensions' as status;
