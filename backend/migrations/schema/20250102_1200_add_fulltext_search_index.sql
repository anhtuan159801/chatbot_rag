-- ============================================================================
-- Schema Migration: Add Full-Text Search Support
-- ============================================================================
-- Author: System
-- Date: 2025-01-02
-- Description: Add full-text search column for hybrid RAG retrieval
-- ============================================================================

-- Add content_vector column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks'
    AND column_name = 'content_vector'
  ) THEN
    ALTER TABLE knowledge_chunks ADD COLUMN content_vector tsvector;
    RAISE NOTICE '✓ Added content_vector column';
  ELSE
    RAISE NOTICE '✓ content_vector column already exists';
  END IF;
END $$;

-- Update existing records
UPDATE knowledge_chunks
SET content_vector = to_tsvector('simple', content)
WHERE content_vector IS NULL;

-- Create auto-update trigger
DROP TRIGGER IF EXISTS knowledge_chunks_content_vector_trigger ON knowledge_chunks;
DROP FUNCTION IF EXISTS knowledge_chunks_content_vector_update();

CREATE OR REPLACE FUNCTION knowledge_chunks_content_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_vector = to_tsvector('simple', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_chunks_content_vector_trigger
  BEFORE INSERT OR UPDATE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION knowledge_chunks_content_vector_update();

-- Create GIN index for fast full-text search
DROP INDEX IF EXISTS knowledge_chunks_content_vector_idx;
CREATE INDEX knowledge_chunks_content_vector_idx ON knowledge_chunks USING GIN (content_vector);

-- ============================================================================
-- Verification
-- ============================================================================
SELECT
    COUNT(*) as total_chunks,
    COUNT(content_vector) as indexed_chunks
FROM knowledge_chunks;

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP TRIGGER IF EXISTS knowledge_chunks_content_vector_trigger ON knowledge_chunks;
-- DROP FUNCTION IF EXISTS knowledge_chunks_content_vector_update();
-- DROP INDEX IF EXISTS knowledge_chunks_content_vector_idx;
-- ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS content_vector;
