import express from 'express';
import { SystemMetrics, KnowledgeDocument } from '../../shared/types';
import { AIService } from './aiService.js';
import { getModels, getAiRoles } from './supabaseService.js';

const router = express.Router();

// Proxy endpoint for AI system analysis using configured model
router.post('/gemini/analyze', async (req, res) => {
  try {
    const { metrics, recentDocs } = req.body as { metrics: SystemMetrics; recentDocs: KnowledgeDocument[] };
    
    // Validate required parameters
    if (!metrics || !recentDocs) {
      return res.status(400).json({ error: 'Missing required parameters: metrics and recentDocs' });
    }

    // Get configured model for analysis role
    const roles = await getAiRoles();
    const models = await getModels();
    const analysisModelId = roles.analysis;
    const modelConfig = models.find(m => m.id === analysisModelId);

    if (!modelConfig || !modelConfig.is_active) {
      console.error('No active model configured for analysis role');
      return res.status(500).json({ error: 'No active model configured for system analysis' });
    }

    console.log(`Using model for analysis: ${modelConfig.name} (${modelConfig.model_string})`);

    const prompt = `
      You are an advanced System Administrator AI for a RAG (Retrieval Augmented Generation) Chatbot system.
      Analyze the following system snapshot and provide a concise, professional status report.

      System Metrics:
      - Health Status: ${metrics.systemHealth}
      - Total Vectors in DB: ${metrics.totalVectors}
      - Daily Requests: ${metrics.dailyRequests}
      - API Latency: ${metrics.apiLatencyMs}ms

      Recent Knowledge Ingestion Activity:
      ${recentDocs.map(d => `- ${d.name} (${d.type}): ${d.status}`).join('\n')}

      Please highlight any potential bottlenecks, suggest optimizations if necessary (e.g. if latency is high), or confirm system stability.
      Keep it under 100 words.
    `;

    const result = await AIService.generateText({
      provider: modelConfig.provider,
      model: modelConfig.model_string,
      apiKey: modelConfig.api_key,
      prompt: prompt,
      systemPrompt: 'You are a helpful system administrator AI assistant.'
    });

    // Validate the response
    if (!result || result.trim().length === 0) {
      return res.status(500).json({ error: "AI response was empty or invalid" });
    }
    
    res.json({ result });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    
    // More specific error handling
    if (error.status === 401) {
      res.status(401).json({ error: "Invalid API Key. Please check your AI API credentials." });
    } else if (error.status === 403) {
      res.status(403).json({ error: "Access denied. Please check your API key permissions." });
    } else if (error.status === 429) {
      res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
    } else {
      res.status(500).json({ error: `Failed to perform AI analysis: ${error.message || 'Unknown error'}` });
    }
  }
});

export default router;