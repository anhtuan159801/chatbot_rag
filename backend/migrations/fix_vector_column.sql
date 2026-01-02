-- Migration: Add content_vector column and index
-- This file adds the content_vector column for pgvector support
-- Run this migration if chunks fail to store due to missing column

-- Add content_vector column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_chunks' 
        AND column_name = 'content_vector'
    ) THEN
        ALTER TABLE knowledge_chunks 
        ADD COLUMN content_vector cube;
        
        COMMENT ON COLUMN knowledge_chunks.content_vector 
        IS 'Vector embedding for semantic search using pgvector';
        
        RAISE NOTICE 'content_vector column added successfully';
    ELSE
        RAISE NOTICE 'content_vector column already exists';
    END IF;
END $$;

-- Create index for vector similarity search
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'knowledge_chunks' 
        AND indexname = 'idx_knowledge_chunks_content_vector'
    ) THEN
        CREATE INDEX idx_knowledge_chunks_content_vector 
        ON knowledge_chunks USING gin (content_vector);
        
        RAISE NOTICE 'Vector index created successfully';
    ELSE
        RAISE NOTICE 'Vector index already exists';
    END IF;
END $$;

-- Alternative: Create IVFFlat index for faster approximate nearest neighbor search
-- Note: IVFFlat requires the column to have exact dimensions
-- Uncomment if you want to use IVFFlat instead of gin
/*
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'knowledge_chunks' 
        AND indexname = 'idx_knowledge_chunks_ivfflat'
    ) THEN
        CREATE INDEX idx_knowledge_chunks_ivfflat 
        ON knowledge_chunks USING ivfflat (content_vector);
        
        RAISE NOTICE 'IVFFlat index created successfully';
    END IF;
END $$;
*/

-- Verify the column and index
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'knowledge_chunks' 
AND column_name = 'content_vector';

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'knowledge_chunks'
AND indexname LIKE '%content_vector%';
