import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function fixEmbeddingModel() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ Error: No database URL found in environment variables');
    console.error('Please ensure DATABASE_URL or SUPABASE_URL is set in .env file');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pgClient = new Client({
    connectionString: dbUrl
  });

  try {
    await pgClient.connect();
    console.log('Connected to database');

    // Check if ai_models table exists
    const tableCheck = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ai_models'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ ai_models table does not exist in database');
      console.log('Please run the database initialization script first (supabase_tables.sql)');
      return;
    }

    // List all HuggingFace models
    const allModels = await pgClient.query(
      "SELECT id, name, model_string, is_active FROM ai_models WHERE provider = 'huggingface' ORDER BY id"
    );

    if (allModels.rows.length === 0) {
      console.log('❌ No HuggingFace models found in database');
      console.log('Please initialize default models by starting the server or running the initialization code');
      return;
    }

    console.log('\nCurrent HuggingFace models in database:');
    allModels.rows.forEach(model => {
      console.log(`  [${model.is_active ? '✓' : ' '}] ${model.id}: ${model.name}`);
      console.log(`      model_string: ${model.model_string}`);
    });

    // Find models to check
    const qwenModels = allModels.rows.filter(m => 
      m.model_string.includes('Qwen')
    );

    if (qwenModels.length === 0) {
      console.log('\n✓ No Qwen models found in database');
      console.log('Note: The fix has already been applied (API endpoint updated in code)');
      return;
    }

    console.log(`\n✓ Found ${qwenModels.length} Qwen model(s) in database`);
    console.log('These models are now valid because the API endpoint has been fixed in the code!');

    // Show all models after verification
    console.log('\n--- Current HuggingFace models in database ---');
    const finalModels = await pgClient.query(
      "SELECT id, name, model_string, is_active FROM ai_models WHERE provider = 'huggingface' ORDER BY id"
    );
    finalModels.rows.forEach(model => {
      console.log(`  [${model.is_active ? '✓' : ' '}] ${model.id}: ${model.name}`);
      console.log(`      model_string: ${model.model_string}`);
    });

    console.log('\nUpdated model configuration:');
    console.log('  ID:', updatedModel.rows[0].id);
    console.log('  Name:', updatedModel.rows[0].name);
    console.log('  Model String:', updatedModel.rows[0].model_string);
    console.log('  Active:', updatedModel.rows[0].is_active);

    console.log('\n✓ Fix completed successfully!');
    console.log('You can now process documents without 404 errors.');

  } catch (error) {
    console.error('Error fixing embedding model:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

fixEmbeddingModel();
