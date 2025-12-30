import dotenv/config';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

async function updateQwen3Model() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('🔧 Updating Qwen3 model configuration...\n');

    const newModelString = 'BAAI/bge-small-en-v1.5';
    const newProvider = 'huggingface';

    await client.query('BEGIN');

    const updateResult = await client.query(
      `
      UPDATE ai_models
      SET model_string = $1,
          provider = $2,
          updated_at = NOW()
      WHERE id IN (
        SELECT model_id FROM ai_role_assignments WHERE role_key = 'rag'
      )
      `,
      [newModelString, newProvider]
    );

    await client.query('COMMIT');

    console.log(`✓ Updated embedding model to: ${newModelString}`);
    console.log(`   Rows affected: ${updateResult.rowCount}\n`);

    const verifyResult = await client.query(`
      SELECT m.id, m.name, m.model_string, m.provider, m.is_active
      FROM ai_models m
      JOIN ai_role_assignments r ON m.id = r.model_id
      WHERE r.role_key = 'rag'
    `);

    console.log('📋 Current RAG model configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const model of verifyResult.rows) {
      console.log(`   ID: ${model.id}`);
      console.log(`   Name: ${model.name}`);
      console.log(`   Model: ${model.model_string}`);
      console.log(`   Provider: ${model.provider}`);
      console.log(`   Active: ${model.is_active ? '✓' : '○'}`);
    }

    await client.end();
    console.log('\n✓ Model update complete!\n');
  } catch (error) {
    console.error('❌ Update error:', error);
    await client.query('ROLLBACK');
    await client.end();
    process.exit(1);
  }
}

updateQwen3Model();
