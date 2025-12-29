# Fix Embedding Dimension Mismatch

## Problem
The system is using `BAAI/bge-small-en-v1.5` embedding model which produces **384 dimensions**, but the database schema expects **1536 dimensions** (OpenAI default).

## Error
```
error: expected 1536 dimensions, not 384
```

## Solution 1: Update Database to Accept 384 Dimensions (Recommended)

Run this SQL script in your Supabase SQL Editor:

```sql
-- Drop the old index
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;

-- Alter the embedding column to accept 384 dimensions
ALTER TABLE knowledge_chunks 
ALTER COLUMN embedding TYPE vector(384);

-- Recreate the index with the correct dimension
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
```

This script is also saved in `fix-embedding-dimension.sql`

## Solution 2: Use OpenAI Embedding Model (Alternative)

If you prefer to keep 1536 dimensions and use OpenAI:

1. Set your OpenAI API key in `.env`:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. Update the embedding model in your database:
   ```sql
   UPDATE ai_models
   SET model_string = 'text-embedding-3-small',
       name = 'OpenAI text-embedding-3-small',
       provider = 'openai'
   WHERE id = 'hf-embed-1';
   ```

3. Restart the server

## Which Solution to Choose?

- **Solution 1 (Recommended)**: Use `BAAI/bge-small-en-v1.5` with 384 dimensions
  - Free HuggingFace model
  - Fast and efficient
  - Good quality embeddings
  - Just need to update database schema

- **Solution 2**: Use OpenAI `text-embedding-3-small` with 1536 dimensions
  - Higher quality embeddings
  - Costs money (OpenAI API)
  - No database schema changes needed
  - Requires OpenAI API key

## After Applying the Fix

1. Restart the server:
   ```bash
   npm run dev
   ```

2. Test document processing - should work without dimension errors
