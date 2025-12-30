import pg from 'pg';
import 'dotenv/config';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

const client = new pg({ connectionString });

async function validateEmbeddingDimensions() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('🔍 Checking embedding dimensions...\n');

    const result = await client.query(`
      SELECT
        id,
        knowledge_base_id,
        array_length(embedding, 1) as dimensions
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      LIMIT 1000
    `);

    const dimensionCounts = new Map<number, number>();

    for (const row of result.rows) {
      const dims = row.dimensions;
      dimensionCounts.set(dims, (dimensionCounts.get(dims) || 0) + 1);

      if (dims !== 384 && dims !== 1024) {
        console.log(`⚠️  Chunk ${row.id} has ${dims} dimensions (expected 384 or 1024)`);
      }
    }

    console.log('\n📊 Dimension Distribution:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [dims, count] of Array.from(dimensionCounts.entries()).sort((a, b) => a[0] - b[0])) {
      const isValid = dims === 384 || dims === 1024;
      const icon = isValid ? '✓' : '⚠️ ';
      console.log(`   ${icon} ${dims} dimensions: ${count} chunks`);
    }

    const invalidCount = Array.from(dimensionCounts.entries())
      .filter(([dims]) => dims !== 384 && dims !== 1024)
      .reduce((sum, [, count]) => sum + count, 0);

    if (invalidCount > 0) {
      console.log('\n❌ Found invalid embeddings!');
      console.log(`   Total invalid chunks: ${invalidCount}`);
      console.log('\n🔧 Run reembedding script to fix:');
      console.log('   npm run reembed');
    } else {
      console.log('\n✓ All embeddings have valid dimensions!');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Validation error:', error);
    await client.end();
    process.exit(1);
  }
}

validateEmbeddingDimensions();
