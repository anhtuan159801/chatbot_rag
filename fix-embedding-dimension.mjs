import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function fixEmbeddingDimension() {
  const connectionString = process.env.SUPABASE_URL;

  if (!connectionString) {
    console.error('❌ SUPABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('🔧 Fixing embedding dimension constraint...\n');

    await client.connect();
    console.log('✓ Connected to database\n');

    // Drop old constraint
    await client.query(`
      ALTER TABLE knowledge_chunks
      DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check
    `);
    console.log('✓ Dropped old constraint\n');

    // Add new flexible constraint
    await client.query(`
      ALTER TABLE knowledge_chunks
      ADD CONSTRAINT knowledge_chunks_embedding_dim_check
      CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, E'[\\[\\]]', ''), ','), E'\\d+')::integer[]) IN (384, 1024))
    `);
    console.log('✓ Added new flexible constraint (accepts 384 or 1024 dimensions)\n');

    // Verify fix
    const verify = await client.query(`
      SELECT
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, E'[\\[\\]]', ''), ','), E'\\d+')::integer[]) = 384 THEN 1 END) as dim_384,
        COUNT(CASE WHEN array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, E'[\\[\\]]', ''), ','), E'\\d+')::integer[]) = 1024 THEN 1 END) as dim_1024
      FROM knowledge_chunks
    `);

    console.log('📊 Current embedding dimensions in database:');
    console.log(`   Total chunks: ${verify.rows[0].total_chunks}`);
    console.log(`   Chunks with 384 dimensions (old model): ${verify.rows[0].dim_384}`);
    console.log(`   Chunks with 1024 dimensions (new model): ${verify.rows[0].dim_1024}`);
    console.log();

    console.log('✅ Fix completed!');
    console.log('💡 Now you can re-embed knowledge base with new model.\n');

    await client.end();
    console.log('✓ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

fixEmbeddingDimension();
