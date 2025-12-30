import { Client } from 'pg';
import dotenv/config';

const connectionString = process.env.SUPABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_URL not set in environment');
  process.exit(1);
}

const client = new Client({ connectionString });

async function validateVectorConsistency() {
  try {
    await client.connect();
    console.log('=== VECTOR CONSISTENCY VALIDATION ===\n');

    const result = await client.query(`
      SELECT id, knowledge_base_id, array_length(embedding, 1) as dimensions
      FROM knowledge_chunks
      WHERE embedding IS NOT NULL
      ORDER BY knowledge_base_id, chunk_index
    `);

    console.log(`📊 Total chunks with embeddings: ${result.rows.length}\n`);

    const dimensionStats = new Map<number, number>();
    const docs = new Set<string>();

    for (const row of result.rows) {
      const dims = row.dimensions;
      dimensionStats.set(dims, (dimensionStats.get(dims) || 0) + 1);
      docs.add(row.knowledge_base_id);

      if (!dims || dims === 0) {
        console.log(`⚠️  Chunk ${row.id} has 0 dimensions`);
      }
    }

    console.log('📏 Dimension Distribution:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [dims, count] of Array.from(dimensionStats.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`   ${dims} dimensions: ${count} chunks`);
    }

    const expectedDimensions = 384;
    const mismatches = Array.from(dimensionStats.entries()).filter(
      ([dims]) => dims !== expectedDimensions
    );

    if (mismatches.length > 0) {
      console.log('\n⚠️  Dimension Mismatches Found!');
      console.log(`   Expected: ${expectedDimensions} dimensions`);
      console.log('   Mismatched:');
      for (const [dims, count] of mismatches) {
        console.log(`      - ${dims} dims: ${count} chunks`);
      }
    } else {
      console.log(`\n✓ All embeddings match expected ${expectedDimensions} dimensions!`);
    }

    console.log(`\n📚 Documents affected: ${docs.size}`);

    await client.end();
    console.log('\n✓ Validation complete!\n');
  } catch (error) {
    console.error('❌ Validation error:', error);
    await client.end();
    process.exit(1);
  }
}

validateVectorConsistency();
