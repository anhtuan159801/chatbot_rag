import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiProxy from './services/apiProxy.js'; // Import the API proxy

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add comprehensive security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Prevent sleep on deployment platforms
  if (req.path === '/health' || req.path === '/ping') {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Use the API proxy routes
app.use('/api', apiProxy);

// Health check endpoint to prevent sleep
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ping endpoint for external keep-alive services
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// For any route that doesn't match a static file, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Keep-alive mechanism to prevent sleep on deployment platforms
setInterval(() => {
  console.log('Keep-alive ping:', new Date().toISOString());
}, 300000); // Every 5 minutes

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check endpoint available at http://localhost:${PORT}/health`);
  console.log(`Ping endpoint available at http://localhost:${PORT}/ping`);
});