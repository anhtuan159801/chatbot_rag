import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { SystemMetrics, KnowledgeDocument } from '../types';

const router = express.Router();

// Proxy endpoint for Gemini API to keep API key secure on the server
router.post('/gemini/analyze', async (req, res) => {
  try {
    const { metrics, recentDocs } = req.body as { metrics: SystemMetrics; recentDocs: KnowledgeDocument[] };
    
    // Validate required parameters
    if (!metrics || !recentDocs) {
      return res.status(400).json({ error: 'Missing required parameters: metrics and recentDocs' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set");
      return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    const ai = new GoogleGenAI({ apiKey });

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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const result = response.text || "Analysis complete, but no text returned.";
    
    // Validate the response
    if (!result || result.trim().length === 0) {
      return res.status(500).json({ error: "AI response was empty or invalid" });
    }
    
    res.json({ result });
  } catch (error: any) {
    console.error("Gemini API Proxy Error:", error);
    
    // More specific error handling
    if (error.status === 401) {
      res.status(401).json({ error: "Invalid API Key. Please check your Gemini API credentials." });
    } else if (error.status === 403) {
      res.status(403).json({ error: "Access denied. Please check your API key permissions." });
    } else if (error.status === 429) {
      res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
    } else if (error.message?.includes("API_KEY")) {
      res.status(500).json({ error: "API Key configuration error. Please verify your API key is set correctly." });
    } else {
      res.status(500).json({ error: `Failed to perform AI analysis: ${error.message || 'Unknown error'}` });
    }
  }
});

export default router;