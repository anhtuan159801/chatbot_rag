import express from "express";
import { config } from "../config/index.js";
import {
  ChatRequest,
  ChatResponse,
  ErrorResponse,
  HealthResponse,
} from "../models/api.js";
import { generateToken } from "../../middleware/auth.js";

const router = express.Router();

router.post("/ask", async (req, res) => {
  try {
    const {
      question,
      sessionId,
      topK = config.rag.defaultTopK,
    } = req.body as ChatRequest;

    if (!question || question.trim().length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Question is required",
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
      return;
    }

    const startTime = Date.now();

    const ragServiceModule = await import("../../services/ragService.js");
    const { ragService } = ragServiceModule;

    const chunks = await ragService.searchKnowledge(question, topK);

    if (chunks.length === 0) {
      res.json({
        answer:
          "Xin lỗi, tôi không tìm thấy thông tin liên quan trong cơ sở dữ liệu. Vui lòng đặt câu hỏi khác hoặc liên hệ quản trị viên.",
        sources: [],
        metadata: {
          model: config.ai.gemini.model,
          latency: Date.now() - startTime,
          chunksRetrieved: 0,
        },
      } as ChatResponse);
      return;
    }

    const context = ragService.formatContext(chunks);

    const prompt = `${context}\n\nDựa trên các thông tin trên, hãy trả lời câu hỏi: ${question}\n\nTrả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

    let answer = "";
    const provider = config.ai.gemini.apiKey ? "gemini" : "huggingface";
    const model = config.ai.gemini.model;

    if (provider === "gemini") {
      try {
        const apiKey = config.ai.gemini.apiKey;
        const messages = [
          {
            role: "system",
            content:
              "Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật.",
          },
          { role: "user", content: prompt },
        ];

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "text/plain",
                temperature: 0.7,
                maxOutputTokens: 1000,
              },
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Gemini API request failed");
        }

        const data = await response.json();
        answer = data.candidates[0]?.content?.parts[0]?.text || "";
      } catch (error: any) {
        console.error("Gemini API error:", error);
        answer = "Lỗi kết nối đến AI service. Vui lòng thử lại sau.";
      }
    } else if (provider === "huggingface") {
      try {
        const { InferenceClient } = await import("@huggingface/inference");
        const client = new InferenceClient(config.ai.huggingface.apiKey);

        const result = await client.textGeneration({
          model:
            config.ai.huggingface.apiKey ||
            "meta-llama/Meta-Llama-3.1-8B-Instruct",
          inputs: prompt,
        });

        answer = result.generated_text || "";
      } catch (error) {
        console.error("HuggingFace API error:", error);
        answer = "Lỗi kết nối đến AI service. Vui lòng thử lại sau.";
      }
    }

    const latency = Date.now() - startTime;

    res.json({
      answer: answer || "Không có phản hồi từ AI.",
      sources: chunks.map((c) => ({
        id: c.id,
        content: c.content.substring(0, 200) + "...",
        similarity: c.similarity,
      })),
      metadata: {
        model: model,
        latency,
        chunksRetrieved: chunks.length,
      },
    } as ChatResponse);
  } catch (error: any) {
    console.error("Error in /api/rag/ask:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        error.message || "An error occurred while processing your request",
      timestamp: new Date().toISOString(),
    } as ErrorResponse);
  }
});

router.get("/token", async (req, res) => {
  try {
    const token = generateToken("default-user", "user");
    res.json({ token, expiresIn: "7d" });
  } catch (error: any) {
    console.error("Error generating token:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate token",
      timestamp: new Date().toISOString(),
    } as ErrorResponse);
  }
});

export const ragRouter = router;
