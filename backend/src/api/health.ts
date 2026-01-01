import express from "express";
import { config, validateConfig } from "../config/index.js";
import { ErrorResponse, HealthResponse } from "../models/api.js";

const router = express.Router();

router.get("/health", (req, res) => {
  const health: HealthResponse = {
    status: "healthy",
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
  };

  res.json(health);
});

router.post("/validate", (req, res) => {
  const validation = validateConfig();
  if (validation.valid) {
    res.json({ valid: true });
  } else {
    const errorResponse: ErrorResponse = {
      error: "Bad Request",
      message: "Configuration errors: " + validation.errors.join(", "),
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(errorResponse);
  }
});

router.get("/config", (req, res) => {
  res.json({
    server: config.server,
    rag: config.rag,
    rateLimit: {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
    },
  });
});

export const healthRouter = router;
