import pg from 'pg';

console.log('=== RAGBOT DIAGNOSTIC TOOL ===\n');

console.log('1. Checking .env variables:');
console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ SET (' + process.env.GEMINI_API_KEY.substring(0, 20) + '...)' : '✗ NOT SET');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('[') ? '✓ SET (' + process.env.OPENAI_API_KEY.substring(0, 20) + '...)' : '✗ NOT SET or INVALID');
console.log('   HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ SET (' + process.env.HUGGINGFACE_API_KEY.substring(0, 20) + '...)' : '✗ NOT SET');
console.log('   OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✓ SET (' + process.env.OPENROUTER_API_KEY.substring(0, 20) + '...)' : '✗ NOT SET');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ SET' : '✗ NOT SET');

const client = new pg.Client({ connectionString: process.env.SUPABASE_URL });

try {
  await client.connect();
  console.log('\n2. Database connection: ✓ SUCCESS\n');
  
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('3. Tables in database:');
  tables.rows.forEach(row => console.log('   -', row.table_name));
  
  console.log('\n4. Knowledge base documents:');
  const kb = await client.query('SELECT id, name, status, vector_count FROM knowledge_base ORDER BY upload_date DESC LIMIT 5');
  if (kb.rows.length === 0) {
    console.log('   No documents found');
  } else {
    kb.rows.forEach(doc => {
      const statusIcon = doc.status === 'COMPLETED' ? '✓' : (doc.status === 'FAILED' ? '✗' : '⏳');
      console.log('   ' + statusIcon, doc.name, '(' + doc.status + ', vectors:', doc.vector_count + ')');
    });
  }
  
  console.log('\n5. Knowledge chunks:');
  const chunks = await client.query('SELECT COUNT(*) as count FROM knowledge_chunks');
  console.log('   Total chunks:', chunks.rows[0].count);
  
  if (chunks.rows[0].count > 0) {
    const samples = await client.query('SELECT id, knowledge_base_id, LEFT(content, 50) as content_preview FROM knowledge_chunks LIMIT 5');
    console.log('   Sample chunks:');
    samples.rows.forEach(row => {
      console.log('   -', 'doc:', row.knowledge_base_id, 'content:', row.content_preview);
    });
  }
  
  console.log('\n6. AI Models:');
  const models = await client.query('SELECT id, provider, model_string, is_active FROM ai_models');
  models.rows.forEach(m => {
    const activeIcon = m.is_active ? '✓' : '○';
    console.log('   ' + activeIcon, m.provider + '/' + m.model_string + ' (ID: ' + m.id + ')');
  });
  
  console.log('\n7. AI Role Assignments:');
  const roles = await client.query('SELECT * FROM ai_role_assignments');
  roles.rows.forEach(r => {
    console.log('   ' + r.role_key, '=>', r.model_id);
  });
  
  console.log('\n8. Checking knowledge_chunks table structure:');
  const columns = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'knowledge_chunks'");
  columns.rows.forEach(col => {
    console.log('   Column:', col.column_name, '| Type:', col.data_type);
  });
  
  await client.end();
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  
  console.log('\n📋 SUMMARY:');
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('[')) {
    console.log('⚠️  CRITICAL ISSUE: OPENAI_API_KEY is not set or invalid!');
    console.log('   → System cannot generate 1536-dim embeddings');
    console.log('   → Documents will remain in PENDING status');
    console.log('\n   TO FIX: Add your OpenAI API key to .env file:');
    console.log('   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx');
  }
  if (chunks.rows[0].count === 0 && kb.rows.length > 0) {
    console.log('⚠️  ISSUE: Documents exist but no chunks found!');
    console.log('   → This means embeddings are not being generated');
    console.log('   → Check server logs for embedding errors');
  }
  
} catch (error) {
  console.error('\n✗ DATABASE ERROR:', error.message);
  console.error('\n   TO FIX: Check your SUPABASE_URL in .env file');
  console.error('   Current value:', process.env.SUPABASE_URL);
}
