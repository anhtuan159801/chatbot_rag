import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import apiProxy from './services/apiProxy.js';
import knowledgeBaseService from './services/knowledgeBaseService.js';
import {
  getConfig,
  updateConfig,
  getModels,
  updateModels,
  getAiRoles,
  updateAiRoles,
  initializeSystemData
} from './services/supabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Facebook configuration will be loaded from Supabase
let fbConfig: { pageId: string; accessToken: string; pageName: string } | null = null;

// AI model configurations will be loaded from Supabase
let modelConfigs: any[] = [];

// AI role assignments will be loaded from Supabase
let aiRoles: Record<string, string> = {};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add comprehensive security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Prevent sleep on deployment platforms
  if (req.path === '/health' || req.path === '/ping') {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Use the API proxy routes
app.use('/api', apiProxy);

// Use the knowledge base service routes
app.use('/api', knowledgeBaseService);

// Endpoint to get Facebook configuration (without sensitive data like access token)
app.get('/api/facebook-config', async (req, res) => {
  try {
    // Load Facebook config from Supabase
    const config = await getConfig('facebook_config');

    if (config) {
      // Return all config except the access token for security
      const { pageId, pageName } = config;
      res.json({ pageId, pageName });
    } else {
      // Return empty config if not found
      res.json({ pageId: '', pageName: '' });
    }
  } catch (error) {
    console.error('Error getting Facebook config:', error);
    res.status(500).json({ error: 'Failed to retrieve Facebook configuration' });
  }
});

// Endpoint to update Facebook configuration
app.post('/api/facebook-config', async (req, res) => {
  try {
    const { pageId, accessToken, pageName } = req.body;

    // Update Facebook config in Supabase
    const updatedConfig = {
      pageId: pageId !== undefined ? pageId : fbConfig?.pageId || '',
      accessToken: accessToken !== undefined ? accessToken : fbConfig?.accessToken || '',
      pageName: pageName !== undefined ? pageName : fbConfig?.pageName || ''
    };

    const success = await updateConfig('facebook_config', updatedConfig);

    if (success) {
      // Update the in-memory cache
      fbConfig = updatedConfig;
      res.json({ success: true, message: 'Facebook configuration updated successfully' });
    } else {
      res.status(500).json({ error: 'Failed to update Facebook configuration' });
    }
  } catch (error) {
    console.error('Error updating Facebook config:', error);
    res.status(500).json({ error: 'Failed to update Facebook configuration' });
  }
});

// Endpoint to get AI model configurations (without API keys for security)
app.get('/api/models', async (req, res) => {
  try {
    // Load models from Supabase
    const models = await getModels();

    // Return model configurations without the API keys for security
    const modelsWithoutKeys = models.map(model => ({
      id: model.id,
      provider: model.provider,
      name: model.name,
      modelString: model.model_string,  // Map the field name to match frontend expectations
      apiKey: '',  // Don't send the API key to the client (security)
      isActive: model.is_active
    }));

    res.json(modelsWithoutKeys);
  } catch (error) {
    console.error('Error getting AI models:', error);
    res.status(500).json({ error: 'Failed to retrieve AI models' });
  }
});

// Endpoint to update AI model configurations
app.post('/api/models', async (req, res) => {
  try {
    const updatedModels = req.body;
    console.log('Received models update request:', JSON.stringify(updatedModels, null, 2));

    // Prepare models for database storage
    // Note: The apiKey field from the request will be ignored,
    // and the system will use environment variables instead
    const modelsForDb = updatedModels.map((model: any) => {
      return {
        id: model.id,
        provider: model.provider,
        name: model.name,
        model_string: model.modelString,
        api_key: '', // We'll let the service layer handle API key from environment variables
        is_active: model.isActive
      };
    });

    const result = await updateModels(modelsForDb);

    if (result.success) {
      // Update the in-memory cache
      modelConfigs = updatedModels;
      res.json({ success: true, message: 'Model configurations updated successfully' });
    } else {
      console.error('Update models failed:', result.error);
      res.status(500).json({ error: result.error || 'Failed to update model configurations' });
    }
  } catch (error) {
    console.error('Error updating AI models:', error);
    res.status(500).json({ error: 'Failed to update model configurations' });
  }
});

// Endpoint to get AI role assignments and system prompt
app.get('/api/roles', async (req, res) => {
  try {
    // Load AI roles from Supabase
    const roles = await getAiRoles();

    // Also get the system prompt from Supabase
    const systemPrompt = await getConfig('system_prompt');

    // Combine roles with system prompt, ensuring all expected fields are present
    const result = {
      chatbotText: roles.chatbotText || 'gemini-1',
      chatbotVision: roles.chatbotVision || 'gemini-1',
      chatbotAudio: roles.chatbotAudio || 'gemini-1',
      rag: roles.rag || 'openai-1',
      analysis: roles.analysis || 'gemini-1',
      sentiment: roles.sentiment || 'hf-1',
      systemPrompt: systemPrompt || 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.'
    };

    res.json(result);
  } catch (error) {
    console.error('Error getting AI roles:', error);
    res.status(500).json({ error: 'Failed to retrieve AI roles' });
  }
});

// Endpoint to update AI role assignments and system prompt
app.post('/api/roles', async (req, res) => {
  try {
    const { chatbotText, chatbotVision, chatbotAudio, rag, analysis, sentiment, systemPrompt } = req.body;

    // Update AI roles in Supabase
    const rolesToUpdate: Record<string, string> = {};
    if (chatbotText !== undefined) rolesToUpdate.chatbotText = chatbotText;
    if (chatbotVision !== undefined) rolesToUpdate.chatbotVision = chatbotVision;
    if (chatbotAudio !== undefined) rolesToUpdate.chatbotAudio = chatbotAudio;
    if (rag !== undefined) rolesToUpdate.rag = rag;
    if (analysis !== undefined) rolesToUpdate.analysis = analysis;
    if (sentiment !== undefined) rolesToUpdate.sentiment = sentiment;

    // Update roles if any need updating
    if (Object.keys(rolesToUpdate).length > 0) {
      // Get existing roles and update with new values
      const existingRoles = await getAiRoles();
      const updatedRoles = { ...existingRoles, ...rolesToUpdate };

      const rolesSuccess = await updateAiRoles(updatedRoles);
      if (!rolesSuccess) {
        res.status(500).json({ error: 'Failed to update AI roles' });
        return;
      }
    }

    // Update system prompt if provided
    if (systemPrompt !== undefined) {
      const promptSuccess = await updateConfig('system_prompt', systemPrompt);
      if (!promptSuccess) {
        res.status(500).json({ error: 'Failed to update system prompt' });
        return;
      }
    }

    // Update the in-memory cache
    aiRoles = await getAiRoles();
    const updatedSystemPrompt = await getConfig('system_prompt');
    if (updatedSystemPrompt) {
      aiRoles.systemPrompt = updatedSystemPrompt;
    }

    res.json({ success: true, message: 'AI roles and system prompt updated successfully' });
  } catch (error) {
    console.error('Error updating AI roles:', error);
    res.status(500).json({ error: 'Failed to update AI roles and system prompt' });
  }
});

// Facebook Webhook Verification Endpoint
app.get('/webhooks/facebook', (req, res) => {
  const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'dvc_verify_token_2024_secure';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('Webhook verification failed:', { mode, token, expected: VERIFY_TOKEN });
      res.status(403).send('Forbidden');
    }
  } else {
    console.log('Missing query parameters for webhook verification');
    res.status(400).send('Bad Request');
  }
});

// Facebook Webhook Message Handler
app.post('/webhooks/facebook', express.raw({ type: 'application/json' }), async (req, res) => {
  const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'dvc_verify_token_2024_secure';
  const signature = req.get('X-Hub-Signature-256');
  
  console.log('Received webhook request:', {
    signature,
    body: typeof req.body === 'string' ? req.body : req.body?.toString ? req.body.toString() : '[Buffer Object]'
  });

  // Parse the request body from raw buffer to JSON
  let body;
  try {
    // Check if body is already an object or a buffer/string
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      // Body is already parsed as an object
      body = req.body;
    } else {
      // Body is a buffer or string, need to parse
      body = JSON.parse(req.body.toString());
    }
  } catch (e) {
    console.error('Error parsing webhook body:', e);
    return res.status(400).send('Bad Request: Invalid JSON');
  }

  // Check if this is an event from a page subscription
  if (body.object === 'page') {
    body.entry.forEach((entry: any) => {
      const webhook_event = entry.messaging[0];
      console.log('Webhook received event:', webhook_event);

      const sender_psid = webhook_event.sender.id;
      console.log('Sender PSID:', sender_psid);

      if (webhook_event.message && webhook_event.message.text) {
        const message_text = webhook_event.message.text;
        console.log('Received message text:', message_text);
        
        processMessageAsync(sender_psid, message_text).catch(err => {
          console.error('Unhandled error in message processing:', err);
        });
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.status(404).send('Not Found');
  }
});

async function processMessageAsync(sender_psid: string, message_text: string) {
  try {
    const config = await getConfig('facebook_config');
    const pageAccessToken = config?.accessToken;

    if (!pageAccessToken) {
      console.error('Page access token not available, cannot send response');
      return;
    }

    let response_text = `Cảm ơn bạn đã gửi tin nhắn: "${message_text}". Đây là phản hồi từ hệ thống chatbot.`;

    try {
      const { AIService } = await import('./services/aiService.js');
      const { ragService } = await import('./services/ragService.js');
      const { convertMarkdownToText, truncateForFacebook } = await import('./services/textFormatter.js');
      const { getModels, getAiRoles } = await import('./services/supabaseService.js');
      
      const systemPrompt = await getConfig('system_prompt') || 'Bạn là trợ lý ảo hữu ích.';
      
      // Get configured models for chatbot and RAG roles
      const roles = await getAiRoles();
      const models = await getModels();
      const chatbotModelId = roles.chatbotText;
      const chatbotModel = models.find(m => m.id === chatbotModelId);

      if (!chatbotModel || !chatbotModel.is_active) {
        console.warn('No active chatbot model configured, using fallback response');
      } else {
        // RAG: Search knowledge base for relevant chunks
        const relevantChunks = await ragService.searchKnowledge(message_text, 3);
        let ragContext = '';
        
        if (relevantChunks.length > 0) {
          ragContext = ragService.formatContext(relevantChunks);
          console.log(`Found ${relevantChunks.length} relevant knowledge chunks`);
        } else {
          console.log('No relevant knowledge chunks found, using general response');
        }

        let prompt = '';
        if (ragContext) {
          prompt = `${systemPrompt}\n\n${ragContext}\n\nDựa trên các thông tin trên, hãy trả lời câu hỏi của người dùng:\n\nCâu hỏi: ${message_text}\n\nHãy trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu và không sử dụng markdown. Nếu thông tin trên không đủ, hãy nói rõ.`;
        } else {
          prompt = `${systemPrompt}\n\nCâu hỏi: ${message_text}\n\nHãy trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu và không sử dụng markdown.`;
        }

        console.log(`Using chatbot model: ${chatbotModel.name} (${chatbotModel.model_string})`);
        
        const response = await AIService.generateText({
          provider: chatbotModel.provider,
          model: chatbotModel.model_string,
          apiKey: chatbotModel.api_key,
          prompt: prompt,
          systemPrompt: systemPrompt
        });

        if (response && response.trim()) {
          // Convert markdown to plain text for Facebook
          response_text = convertMarkdownToText(response);
          // Truncate if too long
          response_text = truncateForFacebook(response_text);
        }
      }
    } catch (aiError) {
      console.error('AI generation failed, using fallback response:', aiError);
    }

    const { sendFbMessage } = await import('./services/facebookService.js');
    await sendFbMessage(sender_psid, response_text, pageAccessToken);
  } catch (error) {
    console.error('Error processing message or sending response:', error);
  }
}

// Health check endpoint to prevent sleep
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ping endpoint for external keep-alive services
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Serve static files from the 'dist' directory
// __dirname is now pointing to /app/dist-server/ when running node dist-server/server.js
// So we need to go up one level to find the 'dist' (frontend) directory
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// For any route that doesn't match a static file, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize system data from Supabase on startup
const initializeSystem = async () => {
  try {
    await initializeSystemData();

    // Load initial configurations into memory
    fbConfig = await getConfig('facebook_config');
    modelConfigs = await getModels();
    aiRoles = await getAiRoles();

    // Add system prompt to aiRoles
    const systemPrompt = await getConfig('system_prompt');
    if (systemPrompt) {
      aiRoles.systemPrompt = systemPrompt;
    }

    console.log('System configurations loaded from Supabase');
  } catch (error) {
    console.error('Error initializing system data:', error);
  }
};

// Initialize system data when server starts and then start listening
initializeSystem().then(() => {
  const keepAliveInterval = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      if (response.ok) {
        console.log('Keep-alive ping:', new Date().toISOString());
      } else {
        console.warn('Keep-alive ping failed:', response.status);
      }
    } catch (err) {
      console.error('Keep-alive ping error:', err);
    }
  }, 240000);

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check endpoint available at http://localhost:${PORT}/health`);
    console.log(`Ping endpoint available at http://localhost:${PORT}/ping`);
    console.log('Keep-alive mechanism active (ping every 4 minutes)');
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    clearInterval(keepAliveInterval);
    process.exit(0);
  });
}).catch(error => {
  console.error('Failed to initialize system:', error);
  process.exit(1);
});

