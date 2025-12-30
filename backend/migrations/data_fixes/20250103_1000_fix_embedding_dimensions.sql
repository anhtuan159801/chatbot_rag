-- ============================================================================
-- Data Fix: Fix Embedding Dimensions
-- ============================================================================
-- Author: System
-- Date: 2025-01-03
-- Description: Fix embedding dimension inconsistencies in knowledge_chunks
-- ============================================================================

-- Drop old dimension constraint if exists
ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check;

-- Add new flexible constraint (accepts 384 or 1024)
ALTER TABLE knowledge_chunks
ADD CONSTRAINT knowledge_chunks_embedding_dim_check
CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, '[\[\]]', ''), ','), '\d+')::integer[]) IN (384, 1024));

-- ============================================================================
-- Verification
-- ============================================================================
-- Check for any chunks with invalid dimensions
SELECT
    COUNT(*) as invalid_chunks
FROM knowledge_chunks
WHERE array_length(unnest(string_to_array(regexp_replace(embedding::text, '[\[\]]', ''), ','))::integer[], 1) NOT IN (384, 1024);

-- Show distribution of embedding dimensions
SELECT
    array_length(unnest(string_to_array(regexp_replace(embedding::text, '[\[\]]', ''), ','))::integer[], 1) as dimensions,
    COUNT(*) as count
FROM knowledge_chunks
GROUP BY array_length(unnest(string_to_array(regexp_replace(embedding::text, '[\[\]]', ''), ','))::integer[], 1);

-- ============================================================================
-- Rollback
-- ============================================================================
-- ALTER TABLE knowledge_chunks DROP CONSTRAINT knowledge_chunks_embedding_dim_check;
-- ALTER TABLE knowledge_chunks
-- ADD CONSTRAINT knowledge_chunks_embedding_dim_check
-- CHECK (array_length(embedding, 1) = 384);
