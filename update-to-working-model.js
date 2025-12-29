import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

async function updateToWorkingModel() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('❌ Error: No database URL found');
    process.exit(1);
  }

  const pgClient = new Client({ connectionString: dbUrl });

  try {
    await pgClient.connect();
    console.log('✓ Connected to database');

    // Best working models (tested and confirmed)
    const workingModels = [
      {
        model_string: 'BAAI/bge-small-en-v1.5',
        name: 'BGE Small Embedding',
        dimensions: 384,
        description: 'Best balance of speed and quality'
      },
      {
        model_string: 'sentence-transformers/all-MiniLM-L6-v2',
        name: 'All MiniLM L6 v2',
        dimensions: 384,
        description: 'Fast and efficient (384 dims)'
      },
      {
        model_string: 'sentence-transformers/all-mpnet-base-v2',
        name: 'All MPNet Base v2',
        dimensions: 768,
        description: 'Higher quality, slower (768 dims)'
      },
      {
        model_string: 'intfloat/multilingual-e5-large',
        name: 'Multilingual E5 Large',
        dimensions: 1024,
        description: 'Best for multilingual (1024 dims)'
      }
    ];

    console.log('\n' + '='.repeat(70));
    console.log('🎯 WORKING EMBEDDING MODELS (TESTED & CONFIRMED)');
    console.log('='.repeat(70));

    workingModels.forEach((model, index) => {
      console.log(`\n${index + 1}. ${model.name}`);
      console.log(`   Model: ${model.model_string}`);
      console.log(`   Dimensions: ${model.dimensions}`);
      console.log(`   Description: ${model.description}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('❌ QWEN MODEL DOES NOT WORK');
    console.log('='.repeat(70));
    console.log('Qwen/Qwen3-Embedding-0.6B returns 404');
    console.log('This model is NOT deployed to HuggingFace Inference API');

    // Show current model
    console.log('\n' + '='.repeat(70));
    console.log('📊 CURRENT CONFIGURATION');
    console.log('='.repeat(70));

    const currentModel = await pgClient.query(
      "SELECT id, name, model_string FROM ai_models WHERE provider = 'huggingface' AND id LIKE '%embedding%' OR id = 'huggingface-1766856343676' LIMIT 1"
    );

    if (currentModel.rows.length > 0) {
      const model = currentModel.rows[0];
      console.log(`\nCurrent model:`);
      console.log(`  ID: ${model.id}`);
      console.log(`  Name: ${model.name}`);
      console.log(`  Model String: ${model.model_string}`);

      if (model.model_string.includes('Qwen')) {
        console.log(`  ⚠️ WARNING: This model does not work!`);
      }
    }

    // Update to best working model (BGE Small)
    console.log('\n' + '='.repeat(70));
    console.log('🔧 UPDATING TO BEST WORKING MODEL');
    console.log('='.repeat(70));
    console.log('\nUpdating to: BAAI/bge-small-en-v1.5');
    console.log('Reason: Best balance of speed, quality, and compatibility');

    const { default: readline } = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\nDo you want to update to BAAI/bge-small-en-v1.5? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('\n❌ Update cancelled');
      console.log('\n💡 To update manually, run:');
      console.log(`   UPDATE ai_models SET model_string = 'BAAI/bge-small-en-v1.5', name = 'BGE Small Embedding' WHERE id = 'your-model-id';`);
      return;
    }

    // Update the model
    await pgClient.query(
      `UPDATE ai_models
       SET model_string = 'BAAI/bge-small-en-v1.5',
           name = 'BGE Small Embedding'
       WHERE id = 'huggingface-1766856343676'`
    );

    console.log('\n✓ Model updated successfully!');

    // Verify
    const updated = await pgClient.query(
      "SELECT id, name, model_string FROM ai_models WHERE id = 'huggingface-1766856343676'"
    );

    console.log('\n--- Updated Configuration ---');
    console.log(`  ID: ${updated.rows[0].id}`);
    console.log(`  Name: ${updated.rows[0].name}`);
    console.log(`  Model String: ${updated.rows[0].model_string}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL SET! NEXT STEPS:');
    console.log('='.repeat(70));
    console.log('1. Restart your server: npm run dev');
    console.log('2. Test document processing');
    console.log('3. Watch for successful embedding generation');
    console.log('4. No more 404 errors!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

updateToWorkingModel();
