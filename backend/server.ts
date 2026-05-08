import { InferenceClient } from "@huggingface/inference";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import apiProxy from "./services/apiProxy.js";
import knowledgeBaseService from "./services/knowledgeBaseService.js";
import { verifyFacebookWebhook } from "./services/webhookVerifier.js";
import {
  getConfig,
  updateConfig,
  getModels,
  updateModels,
  getAiRoles,
  updateAiRoles,
  initializeSystemData,
} from "./services/supabaseService.js";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDM1plwdxfryE6r-bOMWE0ZP_IrkPbz4D0";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Facebook configuration will be loaded from Supabase
let fbConfig: { pageId: string; accessToken: string; pageName: string } | null =
  null;

// AI model configurations will be loaded from Supabase
let modelConfigs: any[] = [];

// AI role assignments will be loaded from Supabase
let aiRoles: Record<string, string> = {};

// Initialize HuggingFace Client
const hfApiKey =
  process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || "";
const hfClient = new InferenceClient(hfApiKey);

// Add comprehensive security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;",
  );
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  // Prevent sleep on deployment platforms
  if (req.path === "/health" || req.path === "/ping") {
    res.setHeader("Cache-Control", "no-cache");
  }
  next();
});

// Facebook Webhook Verification Endpoint (before global JSON parsing)
app.get("/webhooks/facebook", (req, res) => {
  const VERIFY_TOKEN =
    process.env.FB_VERIFY_TOKEN || "dvc_verify_token_2024_secure";
  const APP_SECRET =
    process.env.FB_APP_SECRET ||
    process.env.FB_VERIFY_TOKEN ||
    "dvc_verify_token_2024_secure";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      console.log("Webhook verification failed:", {
        mode,
        token,
        expected: VERIFY_TOKEN,
      });
      res.status(403).send("Forbidden");
    }
  } else {
    console.log("Missing query parameters for webhook verification");
    res.status(400).send("Bad Request");
  }
});

// Facebook Webhook Message Handler (before global JSON parsing to preserve raw body)
app.post(
  "/webhooks/facebook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const VERIFY_TOKEN =
      process.env.FB_VERIFY_TOKEN || "dvc_verify_token_2024_secure";
    const APP_SECRET =
      process.env.FB_APP_SECRET ||
      process.env.FB_VERIFY_TOKEN ||
      "dvc_verify_token_2024_secure";
    const signature = req.get("X-Hub-Signature-256");

    console.log("Received webhook request:", {
      signature,
      body: Buffer.isBuffer(req.body)
        ? req.body.toString()
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body),
    });

    // Verify webhook signature for security
    if (signature) {
      const isValid = verifyFacebookWebhook({
        payload: req.body,
        signature,
        secret: APP_SECRET,
      });

      if (!isValid) {
        console.error("[Webhook] Invalid signature, rejecting request");
        return res.status(403).send("Forbidden: Invalid signature");
      }
    }

    // Parse the request body from raw buffer to JSON
    let body;
    try {
      // The body should be a buffer at this point, so parse it
      body = JSON.parse(req.body.toString());
    } catch (e) {
      console.error("Error parsing webhook body:", e);
      return res.status(400).send("Bad Request: Invalid JSON");
    }

    // Check if this is an event from a page subscription
    if (body.object === "page") {
      body.entry.forEach((entry: any) => {
        const webhook_event = entry.messaging[0];
        console.log("Webhook received event:", webhook_event);

        const sender_psid = webhook_event.sender.id;
        console.log("Sender PSID:", sender_psid);

        if (webhook_event.message && webhook_event.message.text) {
          const message_text = webhook_event.message.text;
          console.log("Received message text:", message_text);

          processMessageAsync(sender_psid, message_text).catch((err) => {
            console.error("Unhandled error in message processing:", err);
          });
        }
      });

      res.status(200).send("EVENT_RECEIVED");
    } else {
      res.status(404).send("Not Found");
    }
  },
);

// Middleware for all other routes (after webhook routes to avoid interfering with webhook body parsing)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Use the API proxy routes
app.use("/api", apiProxy);

// Use the knowledge base service routes
app.use("/api", knowledgeBaseService);

// Endpoint to get Facebook configuration (without sensitive data like access token)
app.get("/api/facebook-config", async (req, res) => {
  try {
    // Load Facebook config from Supabase
    const config = await getConfig("facebook_config");

    if (config) {
      // Return all config except the access token for security
      const { pageId, pageName } = config;
      res.json({ pageId, pageName });
    } else {
      // Return empty config if not found
      res.json({ pageId: "", pageName: "" });
    }
  } catch (error) {
    console.error("Error getting Facebook config:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve Facebook configuration" });
  }
});

// Endpoint to update Facebook configuration
app.post("/api/facebook-config", async (req, res) => {
  try {
    const { pageId, accessToken, pageName } = req.body;

    // Update Facebook config in Supabase
    const updatedConfig = {
      pageId: pageId !== undefined ? pageId : fbConfig?.pageId || "",
      accessToken:
        accessToken !== undefined ? accessToken : fbConfig?.accessToken || "",
      pageName: pageName !== undefined ? pageName : fbConfig?.pageName || "",
    };

    const success = await updateConfig("facebook_config", updatedConfig);

    if (success) {
      // Update the in-memory cache
      fbConfig = updatedConfig;
      res.json({
        success: true,
        message: "Facebook configuration updated successfully",
      });
    } else {
      res
        .status(500)
        .json({ error: "Failed to update Facebook configuration" });
    }
  } catch (error) {
    console.error("Error updating Facebook config:", error);
    res.status(500).json({ error: "Failed to update Facebook configuration" });
  }
});

// Endpoint to get AI model configurations (without API keys for security)
app.get("/api/models", async (req, res) => {
  try {
    // Load models from Supabase
    const models = await getModels();

    // Return model configurations without the API keys for security
    const modelsWithoutKeys = models.map((model) => ({
      id: model.id,
      provider: model.provider,
      name: model.name,
      modelString: model.model_string, // Map the field name to match frontend expectations
      apiKey: "", // Don't send the API key to the client (security)
      isActive: model.is_active,
    }));

    res.json(modelsWithoutKeys);
  } catch (error) {
    console.error("Error getting AI models:", error);
    res.status(500).json({ error: "Failed to retrieve AI models" });
  }
});

// Endpoint to update AI model configurations
app.post("/api/models", async (req, res) => {
  try {
    const updatedModels = req.body;
    console.log(
      "Received models update request:",
      JSON.stringify(updatedModels, null, 2),
    );

    // Prepare models for database storage
    // Note: The apiKey field from the request will be ignored,
    // and the system will use environment variables instead
    const modelsForDb = updatedModels.map((model: any) => {
      return {
        id: model.id,
        provider: model.provider,
        name: model.name,
        model_string: model.modelString,
        api_key: "", // We'll let the service layer handle API key from environment variables
        is_active: model.isActive,
      };
    });

    const result = await updateModels(modelsForDb);

    if (result.success) {
      // Update the in-memory cache
      modelConfigs = updatedModels;
      res.json({
        success: true,
        message: "Model configurations updated successfully",
      });
    } else {
      console.error("Update models failed:", result.error);
      res.status(500).json({
        error: result.error || "Failed to update model configurations",
      });
    }
  } catch (error) {
    console.error("Error updating AI models:", error);
    res.status(500).json({ error: "Failed to update model configurations" });
  }
});

// Endpoint to get AI role assignments and system prompt
app.get("/api/roles", async (req, res) => {
  try {
    // Load AI roles from Supabase
    const roles = await getAiRoles();

    // Also get the system prompt from Supabase
    const systemPrompt = await getConfig("system_prompt");

    // Combine roles with system prompt, ensuring all expected fields are present
    const result = {
      chatbotText: roles.chatbotText || "gemini-1",
      chatbotVision: roles.chatbotVision || "gemini-1",
      chatbotAudio: roles.chatbotAudio || "gemini-1",
      rag: roles.rag || "hf-embed-1",
      analysis: roles.analysis || "gemini-1",
      sentiment: roles.sentiment || "hf-1",
      systemPrompt:
        systemPrompt ||
        "Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.",
    };

    res.json(result);
  } catch (error) {
    console.error("Error getting AI roles:", error);
    res.status(500).json({ error: "Failed to retrieve AI roles" });
  }
});

// Endpoint to update AI role assignments and system prompt
app.post("/api/roles", async (req, res) => {
  try {
    const {
      chatbotText,
      chatbotVision,
      chatbotAudio,
      rag,
      analysis,
      sentiment,
      systemPrompt,
    } = req.body;

    console.log("Received /api/roles request:", {
      hasChatbotText: chatbotText !== undefined,
      hasChatbotVision: chatbotVision !== undefined,
      hasChatbotAudio: chatbotAudio !== undefined,
      hasRag: rag !== undefined,
      hasAnalysis: analysis !== undefined,
      hasSentiment: sentiment !== undefined,
      hasSystemPrompt: systemPrompt !== undefined,
      systemPromptLength: systemPrompt?.length,
    });

    // Update system prompt if provided
    if (systemPrompt !== undefined) {
      console.log("Updating system_prompt in database...");
      const promptSuccess = await updateConfig("system_prompt", systemPrompt);
      if (!promptSuccess) {
        console.error("Failed to update system_prompt in database");
        res.status(500).json({ error: "Failed to update system prompt" });
        return;
      }
      console.log("system_prompt updated successfully");
    }

    // Update AI roles in Supabase (only if any role values are provided)
    const rolesToUpdate: Record<string, string> = {};
    if (chatbotText !== undefined) rolesToUpdate.chatbotText = chatbotText;
    if (chatbotVision !== undefined)
      rolesToUpdate.chatbotVision = chatbotVision;
    if (chatbotAudio !== undefined) rolesToUpdate.chatbotAudio = chatbotAudio;
    if (rag !== undefined) rolesToUpdate.rag = rag;
    if (analysis !== undefined) rolesToUpdate.analysis = analysis;
    if (sentiment !== undefined) rolesToUpdate.sentiment = sentiment;

    // Update roles if any need updating
    if (Object.keys(rolesToUpdate).length > 0) {
      console.log("Updating roles:", rolesToUpdate);
      // Get existing roles and update with new values
      const existingRoles = await getAiRoles();
      const updatedRoles = { ...existingRoles, ...rolesToUpdate };

      const rolesSuccess = await updateAiRoles(updatedRoles);
      if (!rolesSuccess) {
        console.error("Failed to update roles in database");
        res.status(500).json({ error: "Failed to update AI roles" });
        return;
      }
      console.log("Roles updated successfully");
    }

    // Update the in-memory cache
    aiRoles = await getAiRoles();
    const updatedSystemPrompt = await getConfig("system_prompt");
    if (updatedSystemPrompt) {
      aiRoles.systemPrompt = updatedSystemPrompt;
    }

    res.json({
      success: true,
      message: "AI roles and system prompt updated successfully",
    });
  } catch (error) {
    console.error("Error updating AI roles:", error);
    res
      .status(500)
      .json({ error: "Failed to update AI roles and system prompt" });
  }
});

// Endpoint to get RAG configuration
app.get("/api/rag-config", async (req, res) => {
  try {
    const ragConfig = await import("./services/supabaseService.js");
    const config = await ragConfig.getRagConfig();
    res.json(config);
  } catch (error) {
    console.error("Error getting RAG config:", error);
    res.status(500).json({ error: "Failed to retrieve RAG configuration" });
  }
});

// Endpoint to update RAG configuration
app.post("/api/rag-config", async (req, res) => {
  try {
    const ragConfig = await import("./services/supabaseService.js");
    const config = req.body;

    // Validate the configuration
    if (
      typeof config.vectorWeight !== "number" ||
      config.vectorWeight < 0 ||
      config.vectorWeight > 1
    ) {
      return res
        .status(400)
        .json({ error: "vectorWeight must be a number between 0 and 1" });
    }
    if (
      typeof config.keywordWeight !== "number" ||
      config.keywordWeight < 0 ||
      config.keywordWeight > 1
    ) {
      return res
        .status(400)
        .json({ error: "keywordWeight must be a number between 0 and 1" });
    }
    if (typeof config.defaultTopK !== "number" || config.defaultTopK < 1) {
      return res
        .status(400)
        .json({ error: "defaultTopK must be a positive number" });
    }
    if (
      typeof config.minSimilarity !== "number" ||
      config.minSimilarity < 0 ||
      config.minSimilarity > 1
    ) {
      return res
        .status(400)
        .json({ error: "minSimilarity must be a number between 0 and 1" });
    }
    if (
      typeof config.embeddingProvider !== "string" ||
      !config.embeddingProvider
    ) {
      return res
        .status(400)
        .json({ error: "embeddingProvider must be a non-empty string" });
    }
    if (typeof config.embeddingModel !== "string" || !config.embeddingModel) {
      return res
        .status(400)
        .json({ error: "embeddingModel must be a non-empty string" });
    }

    const success = await ragConfig.updateRagConfig(config);
    if (success) {
      res.json({
        success: true,
        message: "RAG configuration updated successfully",
      });
    } else {
      res.status(500).json({ error: "Failed to update RAG configuration" });
    }
  } catch (error) {
    console.error("Error updating RAG config:", error);
    res.status(500).json({ error: "Failed to update RAG configuration" });
  }
});

// Facebook Webhook Verification Endpoint
app.get("/webhooks/facebook", (req, res) => {
  const VERIFY_TOKEN =
    process.env.FB_VERIFY_TOKEN || "dvc_verify_token_2024_secure";
  const APP_SECRET =
    process.env.FB_APP_SECRET ||
    process.env.FB_VERIFY_TOKEN ||
    "dvc_verify_token_2024_secure";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      console.log("Webhook verification failed:", {
        mode,
        token,
        expected: VERIFY_TOKEN,
      });
      res.status(403).send("Forbidden");
    }
  } else {
    console.log("Missing query parameters for webhook verification");
    res.status(400).send("Bad Request");
  }
});

async function processMessageAsync(sender_psid: string, message_text: string) {
  console.log(`\n[WEBHOOK] ====================`);
  console.log(`[WEBHOOK] Processing message from: ${sender_psid}`);
  console.log(`[WEBHOOK] Message: ${message_text}`);
  console.log(`[WEBHOOK] ====================\n`);

  try {
    console.log("[WEBHOOK] Step 1: Getting facebook config...");

    // Check environment variables first (Koyeb deployment)
    let pageAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pageAccessToken) {
      console.log(
        "[WEBHOOK] Environment variable not set, checking database...",
      );
      const config = await getConfig("facebook_config");
      pageAccessToken = config?.accessToken;
    }

    if (!pageAccessToken) {
      console.error(
        "[WEBHOOK] ✗ Page access token not available, cannot send response",
      );
      console.error(
        "[WEBHOOK] ✗ Check FACEBOOK_ACCESS_TOKEN environment variable",
      );
      throw new Error("FACEBOOK_ACCESS_TOKEN not found (env or database)");
    }
    console.log("[WEBHOOK] ✓ Page access token found");

    let response_text = `Cảm ơn bạn đã gửi tin nhắn: "${message_text}". Đây là phản hồi từ hệ thống chatbot.`;

    console.log("[WEBHOOK] Step 2: Loading services...");

    try {
      const { AIService } = await import("./services/aiService.js");
      console.log("[WEBHOOK] ✓ AIService loaded");

      const { RAGService } = await import("./services/ragService.js");
      const ragServiceInstance = new RAGService(hfClient);
      console.log("[WEBHOOK] ✓ RAG service loaded");

      const { convertMarkdownToText, truncateForFacebook } =
        await import("./services/textFormatter.js");
      console.log("[WEBHOOK] ✓ Text formatter loaded");

      const { getModels, getAiRoles } =
        await import("./services/supabaseService.js");
      console.log("[WEBHOOK] ✓ Supabase service loaded");

      console.log("[WEBHOOK] Step 3: Getting system prompt...");
      const systemPrompt =
        (await getConfig("system_prompt")) || "Bạn là trợ lý ảo hữu ích.";
      console.log("[WEBHOOK] ✓ System prompt loaded");

      // Get configured models for chatbot and RAG roles
      console.log("[WEBHOOK] Step 4: Getting AI models and roles...");
      const roles = await getAiRoles();
      console.log("[WEBHOOK] ✓ AI roles loaded:", JSON.stringify(roles));

      const models = await getModels();
      console.log("[WEBHOOK] ✓ AI models loaded:", models.length, "models");

      const chatbotModelId = roles.chatbotText || "gemini-1";
      let chatbotModel = models.find((m) => m.id === chatbotModelId);

      // Fallback to first active model if configured model not found
      if (!chatbotModel) {
        console.warn(
          `[WEBHOOK] ⚠ Chatbot model '${chatbotModelId}' not found, searching for fallback...`,
        );
        chatbotModel = models.find(
          (m) => m.is_active && m.provider === config.ai.defaultProvider,
        );
      }

      // Fallback to config if no model in database
      const defaultProvider = config.ai.defaultProvider;
      const fallbackApiKey = defaultProvider === 'openai' ? OPENAI_API_KEY : (defaultProvider === 'gemini' ? GEMINI_API_KEY : '');
      const fallbackModel = defaultProvider === 'openai' ? OPENAI_MODEL : (defaultProvider === 'gemini' ? GEMINI_MODEL : 'gpt-4o-mini');

      if (!chatbotModel && fallbackApiKey) {
        console.warn(
          `[WEBHOOK] ⚠ No model in database, using config fallback: ${defaultProvider}`,
        );
        chatbotModel = {
          id: `config-${defaultProvider}`,
          provider: defaultProvider,
          name: `${defaultProvider.toUpperCase()} (Config)`,
          model_string: fallbackModel,
          api_key: fallbackApiKey,
          is_active: true,
        };
      }

      if (!chatbotModel) {
        console.error(
          "[WEBHOOK] ✗ No active chatbot model found. Using fallback response.",
        );
        response_text =
          "Xin lỗi, hệ thống AI đang bảo trì. Vui lòng thử lại sau.";
      } else if (!chatbotModel.is_active) {
        console.warn(
          `[WEBHOOK] ⚠ Chatbot model '${chatbotModel.name}' is not active.`,
        );
        response_text = "Xin lỗi, mô hình AI hiện tại đang tạm dừng.";
      } else {
        console.log(
          "[WEBHOOK] ✓ Using chatbot model:",
          chatbotModel.name,
          `(${chatbotModel.provider}/${chatbotModel.model_string})`,
        );

        // RAG: Search knowledge base for relevant chunks
        console.log("[WEBHOOK] Step 5: Skipping RAG - direct AI response");

        const prompt = `${systemPrompt}\n\nCâu hỏi: ${message_text}\n\nHãy trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu và không sử dụng markdown.`;

        console.log("[WEBHOOK] Step 6: 🤖 Generating AI response...");

        // Use API key from database, fallback to environment variable
        let apiKey = chatbotModel.api_key;
        if (!apiKey) {
          const envKey = `${chatbotModel.provider.toUpperCase()}_API_KEY`;
          apiKey = process.env[envKey];
          console.log(
            `[WEBHOOK] Using API key from environment variable: ${envKey}`,
          );
        }

        const response = await AIService.generateText({
          provider: chatbotModel.provider,
          model: chatbotModel.model_string,
          apiKey: apiKey,
          prompt: prompt,
          systemPrompt: systemPrompt,
        });

        console.log("[WEBHOOK] AI Response type:", typeof response);
        console.log("[WEBHOOK] AI Response length:", response?.length || 0);
        console.log(
          "[WEBHOOK] AI Response preview:",
          response?.substring(0, 100) || "EMPTY",
        );

        if (response && response.trim()) {
          // Convert markdown to plain text for Facebook
          response_text = convertMarkdownToText(response);
          console.log("[WEBHOOK] ✓ Response converted to plain text");
          // Truncate if too long
          response_text = truncateForFacebook(response_text);
          console.log("[WEBHOOK] ✓ Response truncated for Facebook");
        } else {
          console.error(
            "[WEBHOOK] ✗ AI response is empty or null, using fallback",
          );
        }
      }
    } catch (aiError) {
      console.error(
        "[WEBHOOK] ✗ AI generation failed, using fallback response:",
        aiError,
      );
    }

    console.log("[WEBHOOK] Step 7: 📤 Sending message to Facebook...");
    const { sendFbMessage } = await import("./services/facebookService.js");
    await sendFbMessage(sender_psid, response_text, pageAccessToken);
    console.log("[WEBHOOK] ✓ Message sent successfully\n");
  } catch (error: any) {
    console.error(
      "[WEBHOOK] ✗ Error processing message or sending response:",
      error,
    );
    console.error("[WEBHOOK] ✗ Error stack:", error?.stack);
  }
}

// Health check endpoint to prevent sleep
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Ping endpoint for external keep-alive services
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Test endpoint for webhook debugging
app.post("/api/test-webhook", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("[TEST WEBHOOK] Simulating webhook with message:", message);

    // Simulate sender PSID (use test ID)
    const testSenderId = "test_user_123";

    // Call processMessageAsync with test data
    await processMessageAsync(testSenderId, message);

    res.json({ success: true, message: "Webhook simulation triggered" });
  } catch (error: any) {
    console.error("[TEST WEBHOOK] Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Webhook simulation failed" });
  }
});

// Serve static files from the 'dist' directory
// __dirname is now pointing to backend/dist-server/ when running node dist-server/server.js
// So we need to go up to root and then to frontend/dist
const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

// For any route that doesn't match a static file, serve the index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Initialize system data from Supabase on startup
const initializeSystem = async () => {
  try {
    await initializeSystemData();
  } catch (err) {
    console.warn("[System] ⚠️ Database not available, skipping system data init");
  }

  try {
    // Load Facebook config from environment variables first, then database
    fbConfig = {
      pageId: process.env.FACEBOOK_PAGE_ID || "",
      accessToken: process.env.FACEBOOK_ACCESS_TOKEN || "",
      pageName: process.env.FACEBOOK_PAGE_NAME || "",
    };

    // If env vars not set, load from database
    if (!fbConfig.accessToken || !fbConfig.pageId) {
      const dbConfig = await getConfig("facebook_config");
      if (dbConfig) {
        fbConfig = {
          pageId: dbConfig.pageId || fbConfig.pageId,
          accessToken: dbConfig.accessToken || fbConfig.accessToken,
          pageName: dbConfig.pageName || fbConfig.pageName,
        };
      }
    }
  } catch (err) {
    console.warn("[System] ⚠️ Facebook config load failed, using env vars");
  }

  try {
    modelConfigs = await getModels();
    aiRoles = await getAiRoles();
  } catch (err) {
    console.warn("[System] ⚠️ Models/Roles load failed, using fallback");
    modelConfigs = [];
    aiRoles = { chatbotText: "config-gemini", chatbotVoice: "config-gemini" };
  }

  // Add system prompt to aiRoles (default if not in database)
  try {
    const systemPrompt = await getConfig("system_prompt");
    if (systemPrompt) {
      aiRoles.systemPrompt = systemPrompt;
    }
  } catch (err) {
    // Use default system prompt
  }

  console.log("System configurations loaded (env vars + Supabase)");
  console.log(
    `Facebook config: pageId=${fbConfig.pageId}, pageName=${fbConfig.pageName}`,
  );
};

// Initialize system data when server starts and then start listening
initializeSystem()
  .then(() => {
    const keepAliveInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${PORT}/health`);
        if (response.ok) {
          console.log("Keep-alive ping:", new Date().toISOString());
        } else {
          console.warn("Keep-alive ping failed:", response.status);
        }
      } catch (err) {
        console.error("Keep-alive ping error:", err);
      }
    }, 240000);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(
        `Health check endpoint available at http://localhost:${PORT}/health`,
      );
      console.log(`Ping endpoint available at http://localhost:${PORT}/ping`);
      console.log("Keep-alive mechanism active (ping every 4 minutes)");
    });

    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down gracefully...");
      clearInterval(keepAliveInterval);
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize system:", error);
    process.exit(1);
  });
