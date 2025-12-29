import dotenv from 'dotenv';
dotenv.config();

async function testModel(modelString) {
  const apiUrl = `https://router.huggingface.co/hf-inference/models/${modelString}/pipeline/feature-extraction`;
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    console.error('❌ HUGGINGFACE_API_KEY not found in .env');
    return;
  }

  console.log(`\n🔍 Testing model: ${modelString}`);
  console.log(`📡 URL: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: "Test text for embedding generation"
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Model WORKS!`);
      console.log(`📊 Status: ${response.status}`);
      console.log(`📦 Response type: ${Array.isArray(data) ? 'Array' : typeof data}`);

      if (Array.isArray(data) && data.length > 0) {
        console.log(`📐 Embedding dimensions: ${data.length}`);
        console.log(`🔢 Sample values: [${data.slice(0, 5).join(', ')}...]`);
      }

      return { success: true, model: modelString, dimensions: data.length };
    } else {
      const errorText = await response.text();
      console.log(`❌ Model FAILED!`);
      console.log(`📊 Status: ${response.status}`);
      console.log(`❗ Error: ${errorText}`);

      if (response.status === 404) {
        console.log(`💡 Reason: Model not found or not deployed to Inference API`);
      } else if (response.status === 401) {
        console.log(`💡 Reason: Invalid API key`);
      } else if (response.status === 429) {
        console.log(`💡 Reason: Rate limit exceeded`);
      }

      return { success: false, model: modelString, error: response.status };
    }
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return { success: false, model: modelString, error: error.message };
  }
}

async function testMultipleModels() {
  const modelsToTest = [
    'Qwen/Qwen3-Embedding-0.6B',
    'BAAI/bge-small-en-v1.5',
    'sentence-transformers/all-MiniLM-L6-v2',
    'sentence-transformers/all-mpnet-base-v2',
    'intfloat/multilingual-e5-large',
    'openai/clip-vit-base-patch32', // Non-embedding model
    'non-existent-model', // Invalid model
  ];

  console.log('='.repeat(70));
  console.log('🧪 HUGGINGFACE EMBEDDING MODEL TESTER');
  console.log('='.repeat(70));

  const results = [];

  for (const model of modelsToTest) {
    const result = await testModel(model);
    results.push(result);

    // Delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Working models: ${working.length}/${results.length}`);
  working.forEach(r => {
    console.log(`   ✓ ${r.model} (${r.dimensions || '?'} dimensions)`);
  });

  console.log(`\n❌ Failed models: ${failed.length}/${results.length}`);
  failed.forEach(r => {
    console.log(`   ✗ ${r.model} - ${r.error}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('💡 HOW TO USE A MODEL');
  console.log('='.repeat(70));
  console.log('1. Choose a model that works from the list above');
  console.log('2. Update the model_string in your database:');
  console.log(`   UPDATE ai_models SET model_string = 'YOUR_MODEL_HERE' WHERE id = 'your-model-id';`);
  console.log('3. Restart the server');
  console.log('4. The code will automatically use the correct API endpoint');
  console.log('='.repeat(70));
}

// Test a specific model if provided, otherwise test multiple
const args = process.argv.slice(2);
if (args.length > 0) {
  const specificModel = args[0];
  testModel(specificModel);
} else {
  testMultipleModels();
}
