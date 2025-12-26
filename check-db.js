import pg from 'pg';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('SUPABASE_URL not set in environment');
  process.exit(1);
}

console.log('Connecting to database...');

const client = new pg({
  connectionString: connectionString,
});

try {
  await client.connect();
  console.log('Connected successfully!');
  
  // Check if knowledge_chunks table exists
  const tableCheck = await client.query(
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_chunks')"
  );
  console.log('knowledge_chunks table exists:', tableCheck.rows[0].exists);
  
  // Count documents in knowledge_base
  const docCount = await client.query('SELECT COUNT(*) FROM knowledge_base');
  console.log('Documents in knowledge_base:', docCount.rows[0].count);
  
  // Count chunks in knowledge_chunks
  const chunkCount = await client.query('SELECT COUNT(*) FROM knowledge_chunks');
  console.log('Chunks in knowledge_chunks:', chunkCount.rows[0].count);
  
  // Show sample documents
  const docs = await client.query('SELECT id, name, status, vector_count FROM knowledge_base LIMIT 5');
  console.log('Sample documents:', docs.rows);
  
  await client.end();
  console.log('Database check complete!');
  
} catch (error) {
  console.error('Database error:', error);
  process.exit(1);
}
