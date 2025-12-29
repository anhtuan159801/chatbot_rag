-- Simple fix for embedding dimension constraint
-- This allows both 384 (old model) and 1024 (new model) dimensions

ALTER TABLE knowledge_chunks
DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding, '[\]\]', ''), ','), '\d+')::integer[]) IN (384, 1024));
