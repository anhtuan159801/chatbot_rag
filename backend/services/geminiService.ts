import { SystemMetrics, KnowledgeDocument } from "../../shared/types.js";

export const analyzeSystemHealth = async (
  metrics: SystemMetrics,
  recentDocs: KnowledgeDocument[]
): Promise<string> => {
  try {
    // Call the backend proxy to keep API key secure
    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metrics, recentDocs })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);

    // More specific error handling
    if (error.message?.includes("401")) {
      throw new Error("Invalid API Key. Please check your Gemini API credentials.");
    } else if (error.message?.includes("403")) {
      throw new Error("Access denied. Please check your API key permissions.");
    } else if (error.message?.includes("429")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (error.message?.includes("API_KEY")) {
      throw new Error("API Key configuration error. Please verify your API key is set correctly.");
    } else {
      throw new Error(`Failed to perform AI analysis: ${error.message || 'Unknown error'}`);
    }
  }
};
