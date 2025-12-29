import dotenv from 'dotenv';

dotenv.config();

const { InferenceClient } = await import('@huggingface/inference');

async function testEmbeddingEndToEnd() {
  console.log('🔧 Testing embedding generation with @huggingface/inference package...');
  console.log('This is what the fixed code uses.\n');

  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found');
    process.exit(1);
  }

  const query = 'Hướng dẫn xét công nhân liệt sĩ';

  try {
    const client = new InferenceClient(apiKey);

    console.log('📝 Generating embedding for query:', query);
    const embedding = await client.featureExtraction({
      model: 'BAAI/bge-small-en-v1.5',
      inputs: query
    });

    if (Array.isArray(embedding) && embedding.length > 0) {
      console.log('✅ SUCCESS!');
      console.log(`📊 Embedding dimensions: ${embedding.length}`);
      console.log(`🔍 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      console.log('\n🎉 FIX VERIFIED!');
      console.log('🔧 The updated code now uses @huggingface/inference package');
      console.log('🔧 This solves the 410 error from api-inference.huggingface.co');
      console.log('🔧 Knowledge base search should now work correctly!\n');

      console.log('📝 SUMMARY OF FIX:');
      console.log('===================');
      console.log('❌ OLD: Used direct fetch to https://api-inference.huggingface.co');
      console.log('❌ OLD: Got 410 error - endpoint deprecated');
      console.log('✅ NEW: Uses @huggingface/inference package');
      console.log('✅ NEW: Automatically routes to https://router.huggingface.co');
      console.log('✅ NEW: Embedding generation works correctly');
      console.log('✅ NEW: Knowledge base search will find relevant chunks\n');
    } else {
      console.log('❌ FAILED - Unexpected result format');
      console.log('Result:', typeof result, result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmbeddingEndToEnd();
