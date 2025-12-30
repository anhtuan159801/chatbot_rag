import express from 'express';
import { config } from '../config/index.js';
import { ChatRequest, ChatResponse, ErrorResponse, HealthResponse } from '../models/api.js';

const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId, topK = config.rag.defaultTopK } = req.body as ChatRequest;

    if (!question || question.trim().length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Question is required',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
      return;
    }

    const startTime = Date.now();

    // Import RAG service dynamically to avoid circular dependencies
    const { ragService } = await import('../../services/ragService.js');
    const { aiService } = await import('../../services/aiService.js');

    // Retrieve relevant knowledge chunks
    const chunks = await ragService.searchKnowledge(question, topK);

    if (chunks.length === 0) {
      res.json({
        answer:
          'Xin lỗi, tôi không tìm thấy thông tin liên quan trong cơ sở dữ liệu. Vui lòng đặt câu hỏi khác hoặc liên hệ quản trị viên.',
        sources: [],
        metadata: {
          model: config.ai.gemini.model,
          latency: Date.now() - startTime,
          chunksRetrieved: 0,
        },
      } as ChatResponse);
      return;
    }

    // Format context for AI
    const context = ragService.formatContext(chunks);

    // Generate response using AI
    const prompt = `${context}\n\nDựa trên các thông tin trên, hãy trả lời câu hỏi: ${question}\n\nTrả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

    const answer = await aiService.generateText({
      provider: 'gemini',
      model: config.ai.gemini.model,
      apiKey: config.ai.gemini.apiKey,
      prompt,
    });

    const latency = Date.now() - startTime;

    res.json({
      answer: answer || 'Không có phản hồi từ AI.',
      sources: chunks.map(c => ({
        id: c.id,
        content: c.content.substring(0, 200) + '...',
        similarity: c.similarity,
      })),
      metadata: {
        model: config.ai.gemini.model,
        latency,
        chunksRetrieved: chunks.length,
      },
    } as ChatResponse);
  } catch (error: any) {
    console.error('Error in /api/rag/ask:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An error occurred while processing your request',
      timestamp: new Date().toISOString(),
    } as ErrorResponse);
  }
});

router.get('/health', async (req, res) => {
  try {
    const { pgClient } = await import('../../services/supabaseService.js');

    const databaseOk = pgClient !== null;
    const vectorOk = true; // Will check vector extension
    const aiOk = !!config.ai.huggingface.apiKey || !!config.ai.gemini.apiKey;

    const health: HealthResponse = {
      status: databaseOk && aiOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: databaseOk,
        ai: aiOk,
        vector: vectorOk,
      },
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: false,
        ai: false,
        vector: false,
      },
    } as HealthResponse);
  }
});

export const ragRouter = router;
