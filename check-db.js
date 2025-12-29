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
  console.log('✓ Connected successfully!\n');

  // Check all tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('📋 Tables:', tables.rows.map(r => r.table_name).join(', '));
  console.log('');

  // Check system_configs
  const configs = await client.query('SELECT key FROM system_configs');
  console.log('🔧 System configs:', configs.rows.length, 'records');
  configs.rows.forEach(c => console.log(`   - ${c.key}`));
  console.log('');

  // Check ai_models
  const models = await client.query('SELECT id, name, provider, is_active FROM ai_models');
  console.log('🤖 AI Models:', models.rows.length, 'records');
  models.rows.forEach(m => {
    console.log(`   - ${m.id} | ${m.name} (${m.provider}) | Active: ${m.is_active}`);
  });
  console.log('');

  // Check ai_role_assignments
  const roles = await client.query('SELECT role_key, model_id FROM ai_role_assignments');
  console.log('🎭 Role assignments:', roles.rows.length, 'records');
  roles.rows.forEach(r => console.log(`   - ${r.role_key} → ${r.model_id}`));
  console.log('');

  // Check knowledge_base
  const docCount = await client.query('SELECT COUNT(*) FROM knowledge_base');
  console.log('📚 Knowledge base documents:', docCount.rows[0].count);
  const docs = await client.query('SELECT id, name, status, vector_count FROM knowledge_base LIMIT 5');
  if (docs.rows.length > 0) {
    console.log('   Sample documents:');
    docs.rows.forEach(d => console.log(`   - ${d.name} (${d.status}): ${d.vector_count} vectors`));
  }
  console.log('');

  // Check knowledge_chunks
  const chunkCount = await client.query('SELECT COUNT(*) FROM knowledge_chunks');
  console.log('📄 Knowledge chunks:', chunkCount.rows[0].count);
  console.log('');

  await client.end();
  console.log('✓ Database check complete!\n');

} catch (error) {
  console.error('✗ Database error:', error);
  process.exit(1);
}
