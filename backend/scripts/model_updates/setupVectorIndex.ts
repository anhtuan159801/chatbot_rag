import { Client } from 'pg';
import 'dotenv/config';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

async function setupVectorIndex() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('🔍 Checking if vector index exists...');
    
    // Check if the index exists
    const indexCheckResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'knowledge_chunks' 
      AND indexname = 'knowledge_chunks_embedding_idx';
    `);

    if (indexCheckResult.rows.length > 0) {
      console.log('✓ Vector index already exists');
    } else {
      console.log('⏳ Creating vector index...');
      
      // Create the vector index using ivfflat for faster similarity search
      await client.query(`
        CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
        ON knowledge_chunks 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      
      console.log('✓ Vector index created successfully');
    }

    // Also create a GIN index for the content column for keyword search
    await client.query(`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_content_gin_idx
      ON knowledge_chunks 
      USING gin (to_tsvector('simple', content));
    `);

    console.log('✓ GIN index for keyword search created/updated');
    
    await client.end();
    console.log('\n✓ Vector index setup complete!');
  } catch (error) {
    console.error('❌ Vector index setup error:', error);
    await client.end();
    process.exit(1);
  }
}

setupVectorIndex();