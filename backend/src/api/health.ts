import express from 'express';
import { config } from '../config/index.js';
import { ErrorResponse } from '../models/api.js';

const router = express.Router();

router.get('/health', (req, res) => {
  const validation = config;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    config: {
      server: {
        port: config.server.port,
        nodeEnv: config.server.nodeEnv,
      },
      database: {
        hasUrl: !!config.database.url,
      },
      ai: {
        hasOpenAI: !!config.ai.openai.apiKey,
        hasGemini: !!config.ai.gemini.apiKey,
        hasHuggingFace: !!config.ai.huggingface.apiKey,
      },
    },
  });
});

router.get('/config', (req, res) => {
  // Return non-sensitive configuration
  res.json({
    server: config.server,
    rag: config.rag,
    rateLimit: {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
    },
  });
});

router.post('/validate', (req, res) => {
  const validation = await import('../config/index.js').then(m => m.validateConfig());

  if (validation.valid) {
    res.json({ valid: true });
  } else {
    res.status(400).json({
      valid: false,
      errors: validation.errors,
    } as ErrorResponse);
  }
});

export const healthRouter = router;
