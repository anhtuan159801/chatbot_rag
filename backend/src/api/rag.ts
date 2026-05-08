import express from "express";
import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/index.js";
import {
  ChatRequest,
  ChatResponse,
  ErrorResponse,
} from "../models/api.js";
import { generateToken } from "../../middleware/auth.js";

const router = express.Router();

router.post("/ask", async (req, res) => {
  try {
    const { question } = req.body as ChatRequest;

    if (!question || question.trim().length === 0) {
      res.status(400).json({
        error: "Bad Request",
        message: "Question is required",
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
      return;
    }

    const startTime = Date.now();

    let answer = "";
    const provider = config.ai.gemini.apiKey ? "gemini" : "huggingface";
    const model = config.ai.gemini.model;

    if (provider === "gemini") {
      try {
        const apiKey = config.ai.gemini.apiKey;

        const prompt = `Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật. Hãy trả lời câu hỏi sau bằng tiếng Việt, ngắn gọn và dễ hiểu:\n\nCâu hỏi: ${question}`;

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
                maxOutputTokens: 2048,
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
        const client = new InferenceClient(config.ai.huggingface.apiKey);

        const prompt = `Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật. Hãy trả lời câu hỏi sau bằng tiếng Việt, ngắn gọn và dễ hiểu:\n\nCâu hỏi: ${question}`;

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
      sources: [],
      metadata: {
        model: model,
        latency,
        chunksRetrieved: 0,
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
