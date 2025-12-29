import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

async function testHuggingFaceEmbedding() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const testText = 'Hướng dẫn xét công nhân liệt sĩ';

  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('🔧 Testing HuggingFace embedding with NEW endpoint...');
  console.log(`📝 Test text: "${testText}"`);

  const apiUrl = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/feature-extraction';

  try {
    console.log(`🌐 Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({
        inputs: testText,
        options: {
          use_cache: true
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('❌ Error response text:', text);
      process.exit(1);
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const embedding = data[0];
      console.log('✅ Embedding generated successfully!');
      console.log(`📊 Embedding dimensions: ${embedding.length}`);
      console.log(`🔍 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      console.log('\n🎉 FIX SUCCESSFUL! HuggingFace API is working correctly.');
    } else {
      console.error('❌ Invalid response format - expected array');
      console.error('❌ Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Exception:', error);
    process.exit(1);
  }
}

testHuggingFaceEmbedding();
