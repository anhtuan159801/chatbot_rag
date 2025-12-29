import { Client } from 'pg';
import { InferenceClient } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

async function reEmbedKnowledgeBase() {
  const connectionString = process.env.SUPABASE_URL;
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!connectionString || !apiKey) {
    console.error('❌ Missing SUPABASE_URL or HUGGINGFACE_API_KEY');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  const hfClient = new InferenceClient(apiKey);

  try {
    console.log('🔄 Re-embedding Knowledge Base with new model...\n');

    await client.connect();
    console.log('✓ Connected to database\n');

    // Get current embedding model
    const modelResult = await client.query(
      "SELECT model_string, name FROM ai_models WHERE id = 'hf-embed-1'"
    );

    if (modelResult.rows.length === 0) {
      console.error('❌ Embedding model not found in database');
      process.exit(1);
    }

    const embeddingModel = modelResult.rows[0];
    console.log(`📋 Using embedding model: ${embeddingModel.name}`);
    console.log(`   Model string: ${embeddingModel.model_string}\n`);

    // Get all documents
    const docsResult = await client.query(
      'SELECT id, name, type FROM knowledge_base WHERE status = $1',
      ['COMPLETED']
    );

    if (docsResult.rows.length === 0) {
      console.log('⚠️  No completed documents found to re-embed');
      await client.end();
      return;
    }

    console.log(`📄 Found ${docsResult.rows.length} documents to re-embed\n`);

    // Process each document
    for (const doc of docsResult.rows) {
      console.log(`\n🔧 Processing: ${doc.name} (${doc.type})`);

      // Get all chunks for this document
      const chunksResult = await client.query(
        'SELECT id, content FROM knowledge_chunks WHERE knowledge_base_id = $1 ORDER BY chunk_index',
        [doc.id]
      );

      console.log(`   Found ${chunksResult.rows.length} chunks`);

      let successCount = 0;
      let failCount = 0;

      // Re-embed each chunk
      for (const chunk of chunksResult.rows) {
        try {
          const embedding = await hfClient.featureExtraction({
            model: embeddingModel.model_string,
            inputs: chunk.content
          });

          if (Array.isArray(embedding) && embedding.length > 0) {
            const vectorString = `[${embedding.map(v => Number(v)).join(',')}]`;

            await client.query(
              'UPDATE knowledge_chunks SET embedding = $1 WHERE id = $2',
              [vectorString, chunk.id]
            );

            successCount++;

            if (successCount % 10 === 0) {
              process.stdout.write(`\r   Progress: ${successCount}/${chunksResult.rows.length} chunks re-embedded`);
            }
          } else {
            failCount++;
            console.error(`   ❌ Failed to embed chunk ${chunk.id}`);
          }
        } catch (error) {
          failCount++;
          console.error(`   ❌ Error embedding chunk ${chunk.id}:`, error.message);
        }
      }

      console.log(`\r   ✅ Completed: ${successCount}/${chunksResult.rows.length} chunks, ${failCount} failed`);
    }

    console.log('\n\n🎉 Re-embedding completed!');
    console.log('✓ All knowledge base chunks have been updated with new embedding model');
    console.log('✓ RAG search will now work better with Vietnamese queries\n');

    await client.end();
    console.log('✓ Database connection closed');

  } catch (error) {
    console.error('\n❌ Error:', error);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

reEmbedKnowledgeBase();
