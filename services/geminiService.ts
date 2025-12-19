import { GoogleGenAI } from "@google/genai";
import { SystemMetrics, KnowledgeDocument } from "../types";

export const analyzeSystemHealth = async (
  metrics: SystemMetrics, 
  recentDocs: KnowledgeDocument[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key is missing. Please provide a valid Gemini API Key to use the AI Analyst.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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

    return response.text || "Analysis complete, but no text returned.";
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return "Failed to perform AI analysis. Please check console logs.";
  }
};
