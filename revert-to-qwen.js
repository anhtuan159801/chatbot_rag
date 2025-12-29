import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function revertToQwen() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('❌ Error: No database URL found');
    process.exit(1);
  }

  const pgClient = new Client({ connectionString: dbUrl });

  try {
    await pgClient.connect();
    console.log('✓ Connected to database');

    // Show current models
    console.log('\n--- Current HuggingFace models ---');
    const currentModels = await pgClient.query(
      "SELECT id, name, model_string, is_active FROM ai_models WHERE provider = 'huggingface' ORDER BY id"
    );
    currentModels.rows.forEach(model => {
      console.log(`  [${model.is_active ? '✓' : ' '}] ${model.id}: ${model.name}`);
      console.log(`      model_string: ${model.model_string}`);
    });

    // Revert to Qwen if user confirms
    console.log('\n⚠ WARNING: This will change the model back to Qwen/Qwen3-Embedding-0.6B');
    console.log('The code has been fixed to use the correct API endpoint, so this should work now!');

    const { default: readline } = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\nDo you want to revert to Qwen model? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Operation cancelled');
      return;
    }

    // Update model back to Qwen
    await pgClient.query(
      `UPDATE ai_models
       SET model_string = 'Qwen/Qwen3-Embedding-0.6B',
           name = 'Qwen3 Embedding'
       WHERE id = $1`,
      ['huggingface-1766856343676']
    );

    console.log('\n✓ Successfully reverted to Qwen model');

    // Verify
    const updatedModels = await pgClient.query(
      "SELECT id, name, model_string, is_active FROM ai_models WHERE id = 'huggingface-1766856343676'"
    );
    console.log('\n--- Updated model ---');
    console.log(`  ID: ${updatedModels.rows[0].id}`);
    console.log(`  Name: ${updatedModels.rows[0].name}`);
    console.log(`  Model String: ${updatedModels.rows[0].model_string}`);
    console.log(`  Active: ${updatedModels.rows[0].is_active}`);

    console.log('\n✓ The model string is now correct and the API endpoint has been fixed!');
    console.log('Restart the server and test document processing.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

revertToQwen();
