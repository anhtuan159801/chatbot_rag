-- ============================================================================
-- Embedding Operation: Update to Multilingual E5 Large for Vietnamese Support
-- ============================================================================
-- Author: System
-- Date: 2025-01-03
-- Description: Update embedding model to intfloat/multilingual-e5-large for better Vietnamese support
-- ============================================================================

-- Step 1: Update vector column dimension constraint to support 1024 dimensions
ALTER TABLE knowledge_chunks
DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(embedding, 1) = 1024);

-- Step 2: Update system config for embedding model
UPDATE system_configs
SET value = '"intfloat/multilingual-e5-large"'::jsonb,
    updated_at = NOW()
WHERE key = 'embedding_model';

-- If embedding_model config doesn't exist, insert it
INSERT INTO system_configs (key, value, updated_at)
VALUES ('embedding_model', '"intfloat/multilingual-e5-large"'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Step 3: Update embedding provider config
INSERT INTO system_configs (key, value, updated_at)
VALUES ('embedding_provider', '"huggingface"'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Step 4: Update RAG config to use the new embedding model
INSERT INTO system_configs (key, value, updated_at)
VALUES ('rag_embedding_model', '"intfloat/multilingual-e5-large"'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Step 5: Delete existing embeddings (they will be re-embedded)
-- WARNING: This removes all existing vector embeddings
DELETE FROM knowledge_chunks
WHERE embedding IS NOT NULL;

-- Verification
SELECT
    'Embedding model updated to intfloat/multilingual-e5-large' as status,
    'Vector dimension updated to 1024' as dimension_info,
    'Existing embeddings removed - please run re-embedding script' as next_step;

-- ============================================================================
-- Rollback
-- ============================================================================
-- -- Restore original dimension (384)
-- ALTER TABLE knowledge_chunks
-- DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;
--
-- ALTER TABLE knowledge_chunks
-- ADD CONSTRAINT knowledge_chunks_embedding_dim_check
-- CHECK (array_length(embedding, 1) = 384);
--
-- -- Restore original embedding model
-- UPDATE system_configs
-- SET value = '"BAAI/bge-small-en-v1.5"'::jsonb,
--     updated_at = NOW()
-- WHERE key = 'embedding_model';
--
-- DELETE FROM system_configs
-- WHERE key = 'rag_embedding_model';
