import { Client } from 'pg';
import { readFileSync } from 'fs';
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

    // Read and execute SQL script
    const sqlScript = readFileSync('update-qwen3-v2.sql', 'utf8');

    // Split script by semicolons and execute each statement
    const statements = sqlScript
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i+1}/${statements.length}] ${stmt.substring(0, 80)}...`);

      await client.query(stmt);
    }

    console.log('\n✅ All SQL statements executed successfully!\n');

    console.log('💡 Qwen3-Embedding-8B Model Info:');
    console.log('   - 8B parameters (much larger than old 33M)');
    console.log('   - 1024 dimensions (more precise than 384)');
    console.log('   - Multilingual support (100+ languages including Vietnamese)');
    console.log('   - Top performance on MTEB benchmark');
    console.log('   - Better understanding of Vietnamese text than English-only models\n');

    console.log('⚠️  IMPORTANT: After this update:');
    console.log('   1. Restart server to apply changes');
    console.log('   2. Re-upload all documents to generate new 1024-dimension embeddings');
    console.log('   3. Knowledge base search will work MUCH BETTER with Vietnamese!\n');

    console.log('\n📝 Example code to use Qwen3-Embedding-8B:');
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
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

updateToQwen3();
