import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.HUGGINGFACE_API_KEY;

if (!apiKey) {
  console.error('❌ HUGGINGFACE_API_KEY not found');
  process.exit(1);
}

async function testWithNewAPI() {
  console.log('🔧 Testing with @huggingface/inference package...');

  try {
    const { InferenceClient } = await import('@huggingface/inference');
    const client = new InferenceClient(apiKey);

    console.log('📝 Test text: "Hướng dẫn xét công nhân liệt sĩ"');
    console.log('🤖 Model: BAAI/bge-small-en-v1.5');

    const result = await client.featureExtraction({
      model: 'BAAI/bge-small-en-v1.5',
      inputs: 'Hướng dẫn xét công nhân liệt sĩ'
    });

    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ SUCCESS!');
      console.log(`📊 Embedding dimensions: ${result.length}`);
      console.log(`🔍 First 5 values: [${result.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    } else {
      console.log('❌ Unexpected result format:', typeof result, result);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('❌ Cause:', error.cause);
    }
  }
}

testWithNewAPI();
