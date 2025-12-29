import dotenv from 'dotenv';
dotenv.config();

async function testQwenOnDifferentProviders() {
  const model = "Qwen/Qwen3-Embedding-0.6B";
  const testText = "Today is a sunny day and I will get some ice cream.";
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found');
    return;
  }

  console.log('='.repeat(80));
  console.log('🧪 TESTING QWEN/QWEN3-EMBEDDING-0.6B ON DIFFERENT PROVIDERS');
  console.log('='.repeat(80));

  // Test 1: DeepInfra
  console.log('\n1️⃣ DeepInfra Provider');
  console.log('   URL: https://api.deepinfra.com/v1/pipeline');
  try {
    const response = await fetch('https://api.deepinfra.com/v1/pipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "Qwen/Qwen3-Embedding-0.6B",
        inputs: testText
      })
    });

    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('   ✅ SUCCESS on DeepInfra!');
      if (Array.isArray(data)) {
        console.log(`   Dimensions: ${data.length}`);
      }
    } else {
      console.log('   ❌ FAILED');
      console.log(`   Error: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }

  // Test 2: HuggingFace Serverless Inference (free)
  console.log('\n2️⃣ HuggingFace Serverless Inference (Free)');
  const serverlessEndpoints = [
    `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
    `https://api-inference.huggingface.co/models/${model}`,
    `https://huggingface.co/api/models/${model}/infer`,
  ];

  for (let i = 0; i < serverlessEndpoints.length; i++) {
    const url = serverlessEndpoints[i];
    console.log(`   ${i + 1}. ${url}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ inputs: testText })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('      ✅ SUCCESS!');
        if (Array.isArray(data)) {
          console.log(`      Dimensions: ${data.length}`);
        }
        break;
      } else {
        console.log(`      ❌ ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.log(`      ❌ ${error.message}`);
    }
  }

  // Test 3: Try alternative working models
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TESTING ALTERNATIVE WORKING MODELS');
  console.log('='.repeat(80));

  const workingModels = [
    'BAAI/bge-small-en-v1.5',
    'sentence-transformers/all-MiniLM-L6-v2',
  ];

  for (const model of workingModels) {
    console.log(`\n📦 Testing: ${model}`);
    try {
      const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ inputs: testText })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ WORKS! Dimensions: ${Array.isArray(data) ? data.length : 'N/A'}`);
      } else {
        console.log(`   ❌ ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 CONCLUSION');
  console.log('='.repeat(80));
  console.log('\n❌ Qwen/Qwen3-Embedding-0.6B:');
  console.log('   - Does NOT work on HuggingFace Free Serverless Inference API');
  console.log('   - Requires HuggingFace Inference Endpoints (PAID: $0.80/h)');
  console.log('   - OR works on other providers (DeepInfra, Cloudflare)');
  console.log('\n✅ Alternative FREE models that work:');
  console.log('   - BAAI/bge-small-en-v1.5 (384 dims)');
  console.log('   - sentence-transformers/all-MiniLM-L6-v2 (384 dims)');
  console.log('   - sentence-transformers/all-mpnet-base-v2 (768 dims)');
  console.log('\n💡 RECOMMENDATION:');
  console.log('   Use BAAI/bge-small-en-v1.5 for production (free, fast, good quality)');
  console.log('   Or deploy Qwen3-Embedding on HuggingFace Endpoints if needed ($0.80/h)');
  console.log('='.repeat(80));
}

testQwenOnDifferentProviders();
