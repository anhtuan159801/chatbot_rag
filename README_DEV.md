# Development Setup Guide

This guide will help you set up the development environment for the Chatbot RAG system.

## Prerequisites

- **Node.js**: >= 20.0.0
- **PostgreSQL**: 13+ (with pgvector extension)
- **Git**: Latest version
- **npm**: Latest version

## Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd chatbot_rag

# Install dependencies (root)
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Environment Variables

```bash
# Copy example file
cp backend/.env.example backend/.env

# Edit with your actual values
nano backend/.env
# or
code backend/.env
```

**Required variables:**

- `SUPABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - For AI chat
- `HUGGINGFACE_API_KEY` - For embeddings
- `JWT_SECRET` - For authentication

### 3. Database Setup

#### Option A: Using Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Run migrations in order:
   ```bash
   # From backend/migrations/schema/
   psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f backend/migrations/schema/20250102_0900_create_complete_schema.sql
   psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f backend/migrations/schema/20250102_1200_add_fulltext_search_index.sql
   ```

#### Option B: Using Migration Scripts

```bash
cd backend
tsx scripts/diagnostics/checkSupabaseHealth.ts
```

### 4. Start Development Server

```bash
# Backend
cd backend
npm run dev
# Server runs on http://localhost:8080

# Frontend (new terminal)
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

## Project Structure

```
chatbot_rag/
├── backend/
│   ├── src/
│   │   ├── api/           # Express routes
│   │   ├── config/        # Configuration
│   │   ├── models/        # TypeScript types
│   │   └── utils/         # Helper functions
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   ├── migrations/      # Database migrations
│   └── scripts/         # Utility scripts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── App.tsx
│   └── package.json
└── shared/
    └── types.ts        # Shared types
```

## Development Workflow

### Running Tests

```bash
cd backend
npm test

cd frontend
npm test
```

### Linting

```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
```

### Building

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Utility Scripts

### Re-embedding Knowledge Base

```bash
cd backend
tsx scripts/reembedding/reembedKnowledgeBase.ts
```

### Validate Embedding Dimensions

```bash
cd backend
tsx scripts/reembedding/validateEmbeddingDimensions.ts
```

### Database Health Check

```bash
cd backend
tsx scripts/diagnostics/checkSupabaseHealth.ts
```

## API Endpoints

### Health Check

```
GET /api/health
GET /api/health/config
POST /api/health/validate
```

### RAG API

```
POST /api/rag/ask
Body: { "question": "your question", "topK": 3 }
```

### Knowledge Base

```
GET /api/knowledge/documents
POST /api/knowledge/upload
DELETE /api/knowledge/:id
```

### AI Models

```
GET /api/models
POST /api/models
```

## Docker Development

### Build Image

```bash
docker build -t chatbot-rag:dev .
```

### Run Container

```bash
docker run -p 8080:8080 \
  --env-file backend/.env \
  chatbot-rag:dev
```

### Docker Compose

```bash
docker-compose up -d
```

## Troubleshooting

### Database Connection Issues

1. Check SUPABASE_URL format
2. Verify database is running
3. Check firewall settings

### Embedding Errors

1. Verify HUGGINGFACE_API_KEY
2. Check EMBEDDING_MODEL is valid
3. Review logs for rate limit errors

### AI Response Issues

1. Verify GEMINI_API_KEY
2. Check network connectivity
3. Review AI model logs

## Next Steps

1. Run database migrations
2. Upload sample documents
3. Test RAG search with `/api/rag/ask`
4. Configure Facebook webhook (optional)
5. Deploy to production

## Resources

- [Backend README](../backend/README.md)
- [Frontend README](../frontend/README.md)
- [API Documentation](API-DOCS.md)
- [Migration Guide](ORGANIZATION-GUIDE.md)
- [Hybrid RAG Guide](HYBRID-RAG-GUIDE.md)
