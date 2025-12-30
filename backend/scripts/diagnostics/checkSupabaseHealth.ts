import { Client } from 'pg';
import dotenv/config;

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

async function checkSupabaseHealth() {
  try {
    await client.connect();
    console.log('=== SUPABASE HEALTH CHECK ===\n');

    console.log('1. Connection Status: ✓ SUCCESS\n');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('2. Tables:');
    tables.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));
    console.log(`   Total: ${tables.rows.length} tables\n`);

    console.log('3. Extensions:');
    const extensions = await client.query(`
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('vector', 'uuid-ossp')
      ORDER BY extname
    `);
    extensions.rows.forEach(row => console.log(`   ✓ ${row.extname}`));
    console.log(`   Total: ${extensions.rows.length} extensions\n`);

    console.log('4. Knowledge Base:');
    const kbResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM knowledge_base
      GROUP BY status
      ORDER BY status
    `);
    kbResult.rows.forEach(row => {
      const icon = row.status === 'COMPLETED' ? '✓' : '⏳';
      console.log(`   ${icon} ${row.status}: ${row.count} documents`);
    });
    console.log(`   Total: ${kbResult.rows.reduce((sum, row) => sum + row.count, 0)} documents\n`);

    console.log('5. Knowledge Chunks:');
    const chunkResult = await client.query(`
      SELECT COUNT(*) as total_chunks,
             COUNT(embedding) as embedded_chunks
      FROM knowledge_chunks
    `);
    console.log(`   Total chunks: ${chunkResult.rows[0].total_chunks}`);
    console.log(`   With embeddings: ${chunkResult.rows[0].embedded_chunks}`);
    console.log(`   Missing embeddings: ${chunkResult.rows[0].total_chunks - chunkResult.rows[0].embedded_chunks}\n`);

    console.log('6. AI Models:');
    const modelsResult = await client.query(`
      SELECT provider, is_active, COUNT(*) as count
      FROM ai_models
      GROUP BY provider, is_active
      ORDER BY provider
    `);
    modelsResult.rows.forEach(row => {
      const icon = row.is_active ? '✓' : '○';
      console.log(`   ${icon} ${row.provider}: ${row.count} models`);
    });
    console.log(`   Total: ${modelsResult.rows.reduce((sum, row) => sum + row.count, 0)} models\n`);

    await client.end();
    console.log('✓ Health check complete!\n');
  } catch (error) {
    console.error('\n❌ Health check error:', error);
    await client.end();
    process.exit(1);
  }
}

checkSupabaseHealth();
