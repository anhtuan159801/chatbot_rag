import dotenv from 'dotenv';
dotenv.config();

console.log('=== Facebook Webhook Debug Tool ===');
console.log('');

console.log('1. Environment Variables Check:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('   GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('   HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '✗ Missing');
console.log('   FACEBOOK_PAGE_ID:', process.env.FACEBOOK_PAGE_ID ? '✓ Set' : '✗ Missing');
console.log('   FACEBOOK_ACCESS_TOKEN:', process.env.FACEBOOK_ACCESS_TOKEN ? '✓ Set' : '✗ Missing');
console.log('   FB_VERIFY_TOKEN:', process.env.FB_VERIFY_TOKEN ? '✓ Set' : '✗ Missing');
console.log('');

import { Client } from 'pg';

async function testDatabaseConnection() {
  console.log('2. Testing Database Connection...');
  try {
    const client = new Client({
      connectionString: process.env.SUPABASE_URL
    });
    await client.connect();
    console.log('   ✓ Database connected successfully');

    const modelsResult = await client.query('SELECT id, name, provider, is_active FROM ai_models');
    console.log(`   ✓ Found ${modelsResult.rows.length} AI models:`);
    modelsResult.rows.forEach(m => {
      console.log(`     - ${m.name} (${m.provider}) - Active: ${m.is_active}`);
    });

    const rolesResult = await client.query('SELECT role_key, model_id FROM ai_role_assignments');
    console.log(`   ✓ Found ${rolesResult.rows.length} role assignments:`);
    rolesResult.rows.forEach(r => {
      console.log(`     - ${r.role_key} → ${r.model_id}`);
    });

    const configResult = await client.query('SELECT key FROM system_configs WHERE key IN ($1, $2)', ['facebook_config', 'system_prompt']);
    console.log(`   ✓ Found ${configResult.rows.length} system configs`);

    const kbResult = await client.query('SELECT COUNT(*) FROM knowledge_base');
    console.log(`   ✓ Knowledge base has ${kbResult.rows[0].count} documents`);

    const chunksResult = await client.query('SELECT COUNT(*) FROM knowledge_chunks');
    console.log(`   ✓ Knowledge base has ${chunksResult.rows[0].count} chunks`);

    await client.end();
    return true;
  } catch (error) {
    console.log('   ✗ Database connection failed:', error.message);
    return false;
  }
}

async function testHuggingFaceEmbedding() {
  console.log('');
  console.log('3. Testing HuggingFace Embedding API...');
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.log('   ✗ HUGGINGFACE_API_KEY not set');
      return false;
    }

    const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5/feature-extraction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Wait-For-Model': 'true'
      },
      body: JSON.stringify({
        inputs: 'test message',
        options: { use_cache: true }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   ✓ Embedding API working (${data[0].length} dimensions)`);
        return true;
      }
    }
    console.log('   ✗ Embedding API failed:', response.status, await response.text());
    return false;
  } catch (error) {
    console.log('   ✗ Embedding API error:', error.message);
    return false;
  }
}

async function testGeminiAPI() {
  console.log('');
  console.log('4. Testing Gemini API...');
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('   ✗ GEMINI_API_KEY not set');
      return false;
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Test message'
    });

    if (response.text && response.text.trim()) {
      console.log('   ✓ Gemini API working');
      return true;
    }
    console.log('   ✗ Gemini API returned empty response');
    return false;
  } catch (error) {
    console.log('   ✗ Gemini API error:', error.message);
    return false;
  }
}

async function testFacebookAPI() {
  console.log('');
  console.log('5. Testing Facebook Graph API...');
  try {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
      console.log('   ✗ Facebook credentials not set');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?access_token=${accessToken}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✓ Facebook API connected - Page: ${data.name}`);
      return true;
    }
    console.log('   ✗ Facebook API failed:', response.status, await response.text());
    return false;
  } catch (error) {
    console.log('   ✗ Facebook API error:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('');
  console.log('6. Webhook Configuration Check:');
  console.log('   Webhook GET endpoint: /webhooks/facebook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE');
  console.log('   Webhook POST endpoint: /webhooks/facebook');
  console.log('');
  console.log('   To verify webhook on Facebook:');
  console.log('   1. Use ngrok to expose local server: ngrok http 8080');
  console.log('   2. Facebook will send GET request to verify');
  console.log('   3. Respond with the challenge token');
  console.log('');
  console.log('   Current FB_VERIFY_TOKEN:', process.env.FB_VERIFY_TOKEN || 'dvc_verify_token_2024_secure');
}

async function main() {
  console.log('');

  const dbOk = await testDatabaseConnection();
  const embeddingOk = await testHuggingFaceEmbedding();
  const geminiOk = await testGeminiAPI();
  const fbOk = await testFacebookAPI();
  await testWebhookEndpoint();

  console.log('');
  console.log('=== Summary ===');
  console.log('   Database:', dbOk ? '✓ OK' : '✗ FAIL');
  console.log('   HuggingFace Embedding:', embeddingOk ? '✓ OK' : '✗ FAIL');
  console.log('   Gemini API:', geminiOk ? '✓ OK' : '✗ FAIL');
  console.log('   Facebook API:', fbOk ? '✓ OK' : '✗ FAIL');
  console.log('');

  if (!dbOk || !embeddingOk || !geminiOk || !fbOk) {
    console.log('❌ Some components are not working. Please check the errors above.');
    process.exit(1);
  } else {
    console.log('✅ All components are working! The webhook should be able to process messages.');
    console.log('');
    console.log('📱 To test Facebook webhook:');
    console.log('   1. Make sure server is running: npm run dev');
    console.log('   2. Expose server: ngrok http 8080');
    console.log('   3. Update Facebook webhook URL: https://your-ngrok-url.com/webhooks/facebook');
    console.log('   4. Test by sending a message to your Facebook page');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
