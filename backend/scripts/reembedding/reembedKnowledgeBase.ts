import { Client } from 'pg';
import { InferenceClient } from '@huggingface/inference';
import 'dotenv/config';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

if (!process.env.HUGGINGFACE_API_KEY) {
  console.error('❌ HUGGINGFACE_API_KEY not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

async function reembedKnowledgeBase() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const embeddingModel = process.env.EMBEDDING_MODEL || 'BAAI/bge-small-en-v1.5';
    console.log(`🤖 Using embedding model: ${embeddingModel}\n`);

    const chunksResult = await client.query(`
      SELECT id, content, knowledge_base_id, chunk_index
      FROM knowledge_chunks
      WHERE embedding IS NULL
      ORDER BY knowledge_base_id, chunk_index
      LIMIT 100
    `);

    if (chunksResult.rows.length === 0) {
      console.log('✓ All chunks have embeddings. Nothing to do.');
      await client.end();
      return;
    }

    console.log(`📊 Found ${chunksResult.rows.length} chunks without embeddings\n`);
    console.log('⏳ Processing chunks...\n');

    const hfClient = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

    let successCount = 0;
    let failCount = 0;

    for (const chunk of chunksResult.rows) {
      try {
        const embedding = await hfClient.featureExtraction({
          model: embeddingModel,
          inputs: chunk.content,
        });

        let embeddingArray: number[] = [];
        if (Array.isArray(embedding)) {
          if (typeof embedding[0] === 'number') {
            embeddingArray = embedding as number[];
          } else if (Array.isArray(embedding[0])) {
            embeddingArray = embedding[0] as number[];
          }
        }

        if (embeddingArray.length === 0) {
          console.error(`❌ Invalid embedding for chunk ${chunk.id}`);
          failCount++;
          continue;
        }

        await client.query(
          `
          UPDATE knowledge_chunks
          SET embedding = $1::vector
          WHERE id = $2
        `,
          [`[${embeddingArray.join(',')}]`, chunk.id]
        );

        successCount++;
        console.log(`✓ Chunk ${chunk.id}: ${embeddingArray.length} dimensions`);

        if (successCount % 10 === 0) {
          console.log(
            `📊 Progress: ${successCount}/${chunksResult.rows.length} chunks processed\n`
          );
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${chunk.id}:`, error);
        failCount++;
      }
    }

    await client.end();

    console.log('\n✓ Re-embedding complete!');
    console.log(`   ✓ Successful: ${successCount}`);
    console.log(`   ✗ Failed: ${failCount}`);
    console.log(`   📊 Total: ${chunksResult.rows.length}\n`);
  } catch (error) {
    console.error('❌ Re-embedding error:', error);
    await client.end();
    process.exit(1);
  }
}

reembedKnowledgeBase();
