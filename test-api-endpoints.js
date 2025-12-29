import dotenv from 'dotenv';
dotenv.config();

async function testDifferentEndpoints() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = "Qwen/Qwen3-Embedding-0.6B";
  const testText = "Today is a sunny day and I will get some ice cream.";

  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found');
    return;
  }

  const endpoints = [
    {
      name: "Inference API (Old)",
      url: `https://api-inference.huggingface.co/models/${model}`,
      body: { inputs: testText }
    },
    {
      name: "Router HF Inference",
      url: `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
      body: { inputs: testText }
    },
    {
      name: "Router Models",
      url: `https://router.huggingface.co/models/${model}`,
      body: { inputs: testText }
    },
    {
      name: "Inference V2",
      url: `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
      body: { inputs: testText }
    }
  ];

  console.log('='.repeat(80));
  console.log('🔍 TESTING DIFFERENT HUGGINGFACE API ENDPOINTS');
  console.log(`📦 Model: ${model}`);
  console.log('='.repeat(80));

  for (const endpoint of endpoints) {
    console.log(`\n📡 ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(endpoint.body)
      });

      const responseText = await response.text();

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          console.log(`   ✅ SUCCESS!`);

          if (Array.isArray(data)) {
            console.log(`   📊 Type: Array`);
            console.log(`   📐 Dimensions: ${data.length}`);
            console.log(`   🔢 Sample: [${data.slice(0, 5).join(', ')}...]`);
          } else if (typeof data === 'object' && data !== null) {
            console.log(`   📊 Type: Object`);
            console.log(`   📦 Keys: ${Object.keys(data).join(', ')}`);
          } else {
            console.log(`   📊 Type: ${typeof data}`);
            console.log(`   📦 Value: ${data}`);
          }

          console.log(`\n   ✨ THIS ENDPOINT WORKS!`);
        } catch (e) {
          console.log(`   ✅ SUCCESS! (Raw response)`);
          console.log(`   📄 Response: ${responseText.substring(0, 200)}...`);
          console.log(`\n   ✨ THIS ENDPOINT WORKS!`);
        }
      } else {
        console.log(`   ❌ FAILED`);
        console.log(`   Error: ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log('\nCheck which endpoint returned ✅ SUCCESS above.');
  console.log('Use that endpoint URL in your code!');
  console.log('='.repeat(80));
}

testDifferentEndpoints();
