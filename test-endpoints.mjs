import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.HUGGINGFACE_API_KEY;

if (!apiKey) {
  console.error('❌ HUGGINGFACE_API_KEY not found');
  process.exit(1);
}

async function testEndpoint(endpoint) {
  const testText = 'Hướng dẫn xét công nhân liệt sĩ';

  console.log(`\n🔍 Testing endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: testText
      })
    });

    const text = await response.text();

    if (response.ok) {
      console.log('✅ SUCCESS!');
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          const embedding = Array.isArray(data[0]) ? data[0] : data;
          console.log(`📊 Embedding dimensions: ${embedding.length}`);
        }
      } catch (e) {
        console.log('📄 Response:', text.substring(0, 100) + '...');
      }
      return true;
    } else {
      console.log(`❌ FAILED - Status: ${response.status}`);
      console.log(`❌ Response: ${text.substring(0, 200)}...`);
      return false;
    }
  } catch (error) {
    console.log(`❌ EXCEPTION:`, error.message);
    return false;
  }
}

async function testAllEndpoints() {
  const endpoints = [
    'https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5/feature-extraction',
    'https://router.huggingface.co/models/BAAI/bge-small-en-v1.5/feature-extraction',
    'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5/feature-extraction',
    'https://router.huggingface.co/v1/models/BAAI/bge-small-en-v1.5/feature-extraction',
  ];

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

testAllEndpoints();
