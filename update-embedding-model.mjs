import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function updateEmbeddingModel() {
  const connectionString = process.env.SUPABASE_URL;

  if (!connectionString) {
    console.error('❌ SUPABASE_URL not found in environment variables');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('🔧 Updating embedding model for better Vietnamese support...\n');

    await client.connect();
    console.log('✓ Connected to database');

    // Check current model
    const currentModel = await client.query(
      "SELECT id, name, model_string FROM ai_models WHERE id = 'hf-embed-1'"
    );

    if (currentModel.rows.length > 0) {
      console.log('📋 Current embedding model:');
      console.log(`   ID: ${currentModel.rows[0].id}`);
      console.log(`   Name: ${currentModel.rows[0].name}`);
      console.log(`   Model: ${currentModel.rows[0].model_string}\n`);
    } else {
      console.log('⚠️  No model found with id = hf-embed-1');
      console.log('   Will create new model instead...\n');

      // Get API key
      const apiKey = process.env.HUGGINGFACE_API_KEY || '';
      if (!apiKey) {
        console.error('❌ HUGGINGFACE_API_KEY not set');
        process.exit(1);
      }

      // Insert new model
      await client.query(
        `INSERT INTO ai_models (id, provider, name, model_string, api_key, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['hf-embed-1', 'huggingface', 'E5 Multilingual Large', 'intfloat/multilingual-e5-large', apiKey, true]
      );
      console.log('✓ Created new embedding model');
    }

    // Update model
    const result = await client.query(
      `UPDATE ai_models
       SET model_string = $1, name = $2
       WHERE id = $3
       RETURNING id, name, model_string`,
      ['intfloat/multilingual-e5-large', 'E5 Multilingual Large (Vietnamese Support)', 'hf-embed-1']
    );

    if (result.rows.length > 0) {
      console.log('✅ Model updated successfully!');
      console.log('\n📋 New model configuration:');
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Model: ${result.rows[0].model_string}\n`);

      console.log('💡 Why this change?');
      console.log('   - OLD: BAAI/bge-small-en-v1.5 (English-only model)');
      console.log('   - NEW: intfloat/multilingual-e5-large (Multilingual, supports Vietnamese)');
      console.log('   - IMPROVEMENT: Better semantic understanding of Vietnamese text\n');

      console.log('⚠️  IMPORTANT: After this update, you need to:');
      console.log('   1. Re-embed all knowledge base documents');
      console.log('   2. This will ensure all chunks use the new model');
      console.log('   3. RAG search will work much better with Vietnamese queries\n');
    } else {
      console.log('⚠️  No changes made');
    }

    await client.end();
    console.log('✓ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

updateEmbeddingModel();
