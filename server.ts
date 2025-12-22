import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiProxy from './services/apiProxy.js'; // Import the API proxy

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// In-memory storage for Facebook configuration
// Note: In a production environment, this should be stored in a persistent database
let fbConfig = {
  pageId: process.env.FACEBOOK_PAGE_ID || '',
  accessToken: process.env.FACEBOOK_ACCESS_TOKEN || '',
  pageName: process.env.FACEBOOK_PAGE_NAME || ''
};

// In-memory storage for AI model configurations
// Note: In a production environment, this should be stored in a persistent database
let modelConfigs = [
  { id: 'gemini-1', provider: 'gemini', name: 'Google Gemini', modelString: 'gemini-3-flash-preview', apiKey: process.env.GEMINI_API_KEY || '', isActive: true },
  { id: 'openai-1', provider: 'openai', name: 'OpenAI', modelString: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY || '', isActive: false },
  { id: 'openrouter-1', provider: 'openrouter', name: 'OpenRouter', modelString: 'openai/whisper-large-v3', apiKey: process.env.OPENROUTER_API_KEY || '', isActive: false },
  { id: 'hf-1', provider: 'huggingface', name: 'Hugging Face', modelString: 'xiaomi/mimo-v2-flash:free', apiKey: process.env.HUGGINGFACE_API_KEY || '', isActive: false },
];

// In-memory storage for AI role assignments
let aiRoles = {
  chatbotText: 'gemini-1',
  chatbotVision: 'gemini-1',
  chatbotAudio: 'gemini-1',
  rag: 'openai-1',
  analysis: 'gemini-1',
  sentiment: 'hf-1',
  systemPrompt: 'Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.'
};

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

// Endpoint to get Facebook configuration (without sensitive data like access token)
app.get('/api/facebook-config', (req, res) => {
  // Return all config except the access token for security
  const { pageId, pageName } = fbConfig;
  res.json({ pageId, pageName });
});

// Endpoint to update Facebook configuration
app.post('/api/facebook-config', (req, res) => {
  const { pageId, accessToken, pageName } = req.body;
  
  if (pageId !== undefined) fbConfig.pageId = pageId;
  if (accessToken !== undefined) fbConfig.accessToken = accessToken;  // In production, validate and hash this
  if (pageName !== undefined) fbConfig.pageName = pageName;
  
  res.json({ success: true, message: 'Facebook configuration updated successfully' });
});

// Endpoint to get AI model configurations (without API keys for security)
app.get('/api/models', (req, res) => {
  // Return model configurations without the API keys for security
  const modelsWithoutKeys = modelConfigs.map(model => ({
    ...model,
    apiKey: ''  // Don't send the API key to the client
  }));
  res.json(modelsWithoutKeys);
});

// Endpoint to update AI model configurations
app.post('/api/models', (req, res) => {
  const updatedModels = req.body;
  
  // Update the model configurations
  modelConfigs = updatedModels.map((model: any) => {
    // Find the existing model to get the API key if it exists
    const existingModel = modelConfigs.find((m: any) => m.id === model.id);
    const apiKey = model.apiKey || (existingModel ? existingModel.apiKey : '');

    return {
      ...model,
      apiKey: apiKey  // Preserve the API key if it was already set and not provided in the request
    };
  });
  
  res.json({ success: true, message: 'Model configurations updated successfully' });
});

// Endpoint to get AI role assignments and system prompt
app.get('/api/roles', (req, res) => {
  res.json(aiRoles);
});

// Endpoint to update AI role assignments and system prompt
app.post('/api/roles', (req, res) => {
  const { chatbotText, chatbotVision, chatbotAudio, rag, analysis, sentiment, systemPrompt } = req.body;
  
  if (chatbotText !== undefined) aiRoles.chatbotText = chatbotText;
  if (chatbotVision !== undefined) aiRoles.chatbotVision = chatbotVision;
  if (chatbotAudio !== undefined) aiRoles.chatbotAudio = chatbotAudio;
  if (rag !== undefined) aiRoles.rag = rag;
  if (analysis !== undefined) aiRoles.analysis = analysis;
  if (sentiment !== undefined) aiRoles.sentiment = sentiment;
  if (systemPrompt !== undefined) aiRoles.systemPrompt = systemPrompt;
  
  res.json({ success: true, message: 'AI roles and system prompt updated successfully' });
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
    body: req.body?.toString ? req.body.toString() : req.body
  });

  // Parse the request body from raw buffer to JSON
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    console.error('Error parsing webhook body:', e);
    return res.status(400).send('Bad Request: Invalid JSON');
  }

  // Check if this is an event from a page subscription
  if (body.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(async (entry: any) => {
      // Get the webhook event. Standby events are triggered when an app is
      // subscribed to the standby webhook and a message is read or marked as
      // seen by the app
      const webhook_event = entry.messaging[0];
      console.log('Webhook received event:', webhook_event);

      // Get the sender PSID (Page Scoped ID)
      const sender_psid = webhook_event.sender.id;
      console.log('Sender PSID:', sender_psid);

      // Check if the message is a text message
      if (webhook_event.message && webhook_event.message.text) {
        const message_text = webhook_event.message.text;
        console.log('Received message text:', message_text);
        
        // Process the user message with your AI and send a response back to the user
        try {
          // In a real implementation, you would call your AI service here
          // For now, let's create a simple response
          const response_text = `Cảm ơn bạn đã gửi tin nhắn: "${message_text}". Đây là phản hồi từ hệ thống chatbot.`;
          
          // Use the stored Facebook configuration
          const pageAccessToken = fbConfig.accessToken;
          
          if (pageAccessToken) {
            // Import the function to send message back to Facebook
            const { sendFbMessage } = await import('./services/facebookService.js');
            await sendFbMessage(sender_psid, response_text, pageAccessToken);
          } else {
            console.log('Page access token not available, skipping response');
          }
        } catch (error) {
          console.error('Error processing message or sending response:', error);
        }
      }
    });

    // Return a '200 OK' response to all webhook events
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.status(404).send('Not Found');
  }
});

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

// Keep-alive mechanism to prevent sleep on deployment platforms
setInterval(() => {
  console.log('Keep-alive ping:', new Date().toISOString());
}, 300000); // Every 5 minutes

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check endpoint available at http://localhost:${PORT}/health`);
  console.log(`Ping endpoint available at http://localhost:${PORT}/ping`);
});
