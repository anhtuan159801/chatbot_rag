import express from "express";
import { InferenceClient } from "@huggingface/inference";
import { config } from "../config/index.js";
import {
  ChatRequest,
  ChatResponse,
  ErrorResponse,
} from "../models/api.js";
import { generateToken } from "../../middleware/auth.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

function loadLocalKnowledge(): string {
  try {
    const knowledgePath = path.join(__dirname, "../../data/knowledge.json");
    if (fs.existsSync(knowledgePath)) {
      const data = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
      const entries = Object.values(data) as any[];
      return entries.map((e: any) => e.content).join("\n\n");
    }
  } catch (err) {
    console.warn("[LOCAL_KB] Failed to load knowledge.json:", err);
  }
  return "";
}

function findRelevantKnowledge(question: string, knowledge: string): string {
  const q = question.toLowerCase();
  const keywords = [
    "liên hệ", "số điện thoại", "điện thoại", "phone", "call",
    "khu phố 69", "khu 69", "ban quản lý", "trưởng khu", "bí thư",
    "chủ tịch", "công an phường", "phụ nữ", "đoàn", "khuyến học"
  ];
  
  const hasKeyword = keywords.some(k => q.includes(k.toLowerCase()));
  if (hasKeyword && knowledge) {
    return knowledge;
  }
  return "";
}

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

    let relevantContext = "";
    let sources: string[] = ["Thông tin liên hệ Khu phố 69 - Lưu trữ nội bộ"];
    let chunksRetrieved = 0;

    const localKnowledge = loadLocalKnowledge();
    const localContext = findRelevantKnowledge(question, localKnowledge);
    if (localContext) {
      relevantContext = localContext;
      chunksRetrieved = 1;
      console.log("[LOCAL_KB] Found relevant local knowledge");
    }

    let answer = "";
    const provider = config.ai.gemini.apiKey ? "gemini" : "huggingface";
    const model = config.ai.gemini.model;

    const contextInstruction = relevantContext
      ? `\n\n=== THÔNG TIN TỪ CƠ SỞ DỮ LIỆU ===\n${relevantContext}\n=== HẾT THÔNG TIN ===\n\nKhi trả lời, hãy ưu tiên sử dụng thông tin từ cơ sở dữ liệu trên và trích dẫn nguồn nếu có.`
      : "";

    if (provider === "gemini") {
      try {
        const apiKey = config.ai.gemini.apiKey;

        const prompt = `Bạn là Trợ lý ảo Hỗ trợ Thủ tục Hành chính công. Nhiệm vụ của bạn là hướng dẫn công dân chuẩn bị hồ sơ, giải đáp thắc mắc về quy trình, lệ phí và thời gian giải quyết một cách chính xác, lịch sự và căn cứ theo văn bản pháp luật hiện hành. Tuyệt đối không tư vấn các nội dung trái pháp luật. Hãy trả lời câu hỏi sau bằng tiếng Việt, ngắn gọn và dễ hiểu:${contextInstruction}\n\nCâu hỏi: ${question}`;

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
      sources: sources,
      metadata: {
        model: model,
        latency,
        chunksRetrieved: chunksRetrieved,
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

router.post("/add-knowledge", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      res.status(400).json({
        error: "Bad Request",
        message: "Title and content are required",
      });
      return;
    }

    const dataDir = path.join(__dirname, "../../data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const knowledgePath = path.join(dataDir, "knowledge.json");
    let existingData: any = {};
    
    if (fs.existsSync(knowledgePath)) {
      existingData = JSON.parse(fs.readFileSync(knowledgePath, "utf-8"));
    }

    const key = title.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    existingData[key] = { title, content, updatedAt: new Date().toISOString() };

    fs.writeFileSync(knowledgePath, JSON.stringify(existingData, null, 2));

    res.json({
      success: true,
      message: `Đã thêm "${title}" vào cơ sở tri thức local`,
      key,
    });
  } catch (error: any) {
    console.error("Error adding knowledge:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

export const ragRouter = router;
