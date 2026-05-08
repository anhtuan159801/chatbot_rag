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
import { getClient, getAiRoles, getModels, searchByKeywords, searchByVector } from "../../services/supabaseService.js";
import { embeddingService } from "../../services/embeddingService.js";

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

    let relevantContext = "";
    let sources: string[] = [];
    let chunksRetrieved = 0;

    try {
      const pg = await getClient();
      if (pg) {
        const keywordResults = await searchByKeywords(question, 5);
        if (keywordResults.length > 0) {
          relevantContext = keywordResults
            .map((r: any) => r.content)
            .join("\n\n");
          sources = [...new Set(keywordResults.map((r: any) => r.metadata?.source || r.metadata?.content_url || "")).filter(Boolean)];
          chunksRetrieved = keywordResults.length;
          console.log(`[RAG] Found ${chunksRetrieved} relevant chunks`);
        }
      }
    } catch (ragError) {
      console.warn("[RAG] Search failed, continuing without context:", ragError);
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

    const pg = await getClient();
    if (!pg) {
      res.status(500).json({ error: "Database not connected" });
      return;
    }

    const documentId = crypto.randomUUID();
    
    await pg.query(
      `INSERT INTO knowledge_base (id, name, type, size, content_url, status)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING')
       RETURNING id, name, type, status, upload_date`,
      [documentId, title, "TEXT", `${(content.length / 1024).toFixed(2)} KB`, null],
    );

    const chunks = content.split(/\n\n+/).filter(c => c.trim());
    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await embeddingService.generateEmbedding(chunks[i]);
        if (embedding) {
          const embeddingStr = embedding.join(",");
          await pg.query(
            `INSERT INTO knowledge_chunks (knowledge_base_id, content, embedding, chunk_index, metadata)
             VALUES ($1, $2, string_to_array($3, ',')::float4[]::vector, $4, $5)`,
            [
              documentId,
              chunks[i],
              embeddingStr,
              i,
              JSON.stringify({ source: title, type: "TEXT" }),
            ],
          );
          successCount++;
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i}:`, chunkError);
      }
    }

    await pg.query(
      "UPDATE knowledge_base SET status = $1, vector_count = $2 WHERE id = $3",
      [successCount > 0 ? "COMPLETED" : "FAILED", successCount, documentId],
    );

    res.json({
      success: true,
      message: `Đã thêm ${successCount} chunks vào cơ sở tri thức`,
      documentId,
      chunksCount: successCount,
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
