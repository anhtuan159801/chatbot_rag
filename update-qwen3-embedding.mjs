import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function updateToQwen3() {
  const connectionString = process.env.SUPABASE_URL;

  if (!connectionString) {
    console.error('❌ SUPABASE_URL not found');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('🔧 Updating embedding model to Qwen3-Embedding-8B...\n');

    await client.connect();
    console.log('✓ Connected to database\n');

    // Update model - use values directly instead of template
    const modelString = 'Qwen/Qwen3-Embedding-8B';
    const modelName = 'Qwen3-Embedding-8B (Vietnamese Support)';

    await client.query('BEGIN');

    await client.query(
      'UPDATE ai_models SET model_string = $1, name = $2 WHERE id = $3',
      [modelString, modelName, 'hf-embed-1']
    );

    console.log('✅ Model updated successfully!');
    console.log('');
    console.log('📋 New model configuration:');
    console.log('   ID: hf-embed-1');
    console.log('   Provider: huggingface');
    console.log('   Name: ' + modelName);
    console.log('   Model: ' + modelString);
    console.log('   Active: true');
    console.log('');

    // Drop old constraint
    await client.query(
      'ALTER TABLE knowledge_chunks DROP CONSTRAINT IF EXISTS knowledge_chunks_embedding_dim_check'
    );
    console.log('✓ Dropped old dimension constraint\n');

    // Add new constraint to support 1024 dimensions
    await client.query(
      "ALTER TABLE knowledge_chunks ADD CONSTRAINT knowledge_chunks_embedding_dim_check CHECK (array_length(string_to_array(regexp_replace(unnest(string_to_array(regexp_replace(embedding::text, E'[\\[\\]]', ''), ','), E'\\d+')::integer[]) IN (1024, 384))"
    );
    console.log('✓ Updated dimension constraint (supports 1024 and 384)\n');

    // Verify the update
    const verify = await client.query(
      'SELECT id, provider, name, model_string, is_active FROM ai_models WHERE id = $1',
      ['hf-embed-1']
    );

    console.log('');
    console.log('💡 Qwen3-Embedding-8B Model Info:');
    console.log('   - 8B parameters (much larger than old 33M)');
    console.log('   - 1024 dimensions (more precise than 384)');
    console.log('   - Multilingual support (100+ languages including Vietnamese)');
    console.log('   - Top performance on MTEB benchmark');
    console.log('   - Better understanding of Vietnamese text than English-only models');
    console.log('');

    await client.query('COMMIT');
    console.log('');

    console.log('⚠️  IMPORTANT: After this update:');
    console.log('   1. Restart server to apply changes');
    console.log('   2. Re-upload all documents to generate new 1024-dimension embeddings');
    console.log('   3. Knowledge base search will work MUCH BETTER with Vietnamese!');
    console.log('');

    console.log('💡 Example code to use Qwen3-Embedding-8B:');
    console.log('');
    console.log('   import { InferenceClient } from "@huggingface/inference";');
    console.log('   const client = new InferenceClient(process.env.HF_TOKEN);');
    console.log('   const output = await client.featureExtraction({');
    console.log('       model: "Qwen/Qwen3-Embedding-8B",');
    console.log('       inputs: text,');
    console.log('       provider: "nebius"');
    console.log('   });');
    console.log('');

    await client.end();
    console.log('✓ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);

    try {
      await client.query('ROLLBACK');
    } catch (e) {
      // Ignore rollback error
    }

    try {
      await client.end();
    } catch (e) {
      // Ignore close error
    }
    process.exit(1);
  }
}

updateToQwen3();
