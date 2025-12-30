import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config/index.js';
import { generateToken } from '../middleware/auth.js';
import { logRequest } from '../middleware/logger.js';
import { ragRouter } from './api/rag.js';
import { healthRouter } from './api/health.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const app = express();

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(config.rateLimit.windowMs / 1000),
    });
  },
});

const PORT = config.server.port;

const pgClient = new pg({
  connectionString: config.database.url,
});

app.use(helmet());
app.use(express.json());

app.use('/api', logRequest);

app.use('/api', apiLimiter);

app.use('/api/rag', ragRouter);
app.use('/api/health', healthRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Chatbot RAG API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      rag: '/api/rag/ask',
      config: '/api/config',
    },
  });
});

app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  try {
    await pgClient.connect();
    await pgClient.query('SELECT 1');
    health.database = true;
  } catch {
    health.database = false;
  }

  res.json(health);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
