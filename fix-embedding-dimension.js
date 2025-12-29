import { Client } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function fixEmbeddingDimension() {
  const connectionString = process.env.SUPABASE_URL;
  
  if (!connectionString) {
    console.error('Error: SUPABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log('[FIX] Connecting to database...');
    await client.connect();
    console.log('[FIX] ✓ Connected');

    // Step 1: Check current dimension
    console.log('\n[FIX] Checking current embedding dimension...');
    const checkResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_chunks' 
      AND column_name = 'embedding'
    `);
    
    if (checkResult.rows.length > 0) {
      const dataType = checkResult.rows[0].data_type;
      const currentDim = dataType.match(/vector\((\d+)\)/);
      if (currentDim) {
        console.log(`[FIX] Current dimension: ${currentDim[1]}`);
      }
    }

    // Step 2: Drop existing index
    console.log('\n[FIX] Dropping existing index...');
    await client.query('DROP INDEX IF EXISTS idx_knowledge_chunks_embedding');
    console.log('[FIX] ✓ Index dropped');

    // Step 3: Alter column to 384 dimensions
    console.log('\n[FIX] Updating embedding column to 384 dimensions...');
    await client.query('ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(384)');
    console.log('[FIX] ✓ Column updated to 384 dimensions');

    // Step 4: Recreate index
    console.log('\n[FIX] Recreating index...');
    await client.query('CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)');
    console.log('[FIX] ✓ Index recreated');

    // Step 5: Verify the change
    console.log('\n[FIX] Verifying the change...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_chunks' 
      AND column_name = 'embedding'
    `);
    
    if (verifyResult.rows.length > 0) {
      const dataType = verifyResult.rows[0].data_type;
      const newDim = dataType.match(/vector\((\d+)\)/);
      if (newDim && newDim[1] === '384') {
        console.log(`[FIX] ✓ Verified: Embedding column is now ${newDim[1]} dimensions`);
      } else {
        console.log(`[FIX] ✗ Warning: Unexpected dimension format: ${dataType}`);
      }
    }

    console.log('\n[SUCCESS] ✓✓✓ Database schema updated successfully!');
    console.log('[SUCCESS] You can now process documents without dimension errors');
    console.log('[SUCCESS] Restart your server to apply changes');

  } catch (error) {
    console.error('\n[ERROR] Failed to fix embedding dimension:', error.message);
    
    if (error.code === '42703') {
      console.error('[ERROR] Column or table not found. Make sure the tables exist.');
    } else if (error.code === '42P01') {
      console.error('[ERROR] Table not found. Please run supabase_tables.sql first.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n[FIX] Database connection closed');
  }
}

fixEmbeddingDimension();
