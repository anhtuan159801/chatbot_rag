# Docker Deployment Guide

## Quick Start

### Prerequisites

- Docker installed
- `.env` file with required environment variables

### 1. Setup Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values
```

Required variables:

- `SUPABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `HUGGINGFACE_API_KEY` - HuggingFace API key

### 2. Docker Build (Local)

```bash
# Build image
docker build -t chatbot-rag .

# Run container
docker run -p 8080:8080 \
  --env-file backend/.env \
  chatbot-rag
```

### 3. Docker Compose

```bash
# Start backend and PostgreSQL
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

### 4. GitHub Actions CI/CD

The Dockerfile is set up to work with GitHub Actions. Push to `main` branch triggers automatic build and deployment.

## Troubleshooting

### Build Failed?

If Docker build fails:

1. **Check .dockerignore**

   ```bash
   # Ensure these are not in build context:
   - node_modules
   - .git
   - dist
   - frontend/dist
   - backend/dist
   ```

2. **Build locally first**

   ```bash
   # Build backend
   cd backend
   npm run build

   # Build frontend (optional)
   cd frontend
   npm run build
   ```

3. **Check Dockerfile paths**
   - All paths in Dockerfile should be relative
   - Don't use absolute paths like `C:\...`

### Container Won't Start?

1. **Check if port 8080 is in use**

   ```bash
   # Windows
   netstat -ano | findstr :8080

   # Linux/Mac
   lsof -i :8080
   ```

2. **Check container logs**

   ```bash
   docker logs <container_id>
   ```

3. **Check if dist-server exists**
   ```bash
   ls -la backend/dist-server
   ```

If dist-server doesn't exist, build it first:

```bash
cd backend
npm run build
```

### Health Check Failing?

The health check has fallback `|| exit 0` to prevent build failures.

## Environment Variables Reference

See `backend/.env.example` for all available variables.

## Development vs Production

**Development:**

```bash
# Use docker-compose for easier local development
docker-compose up --build
```

**Production:**

```bash
# Build and push to trigger GitHub Actions
git push origin main

# Image will be built and deployed automatically
```

## Platform-Specific Scripts

For easier local development, use the platform scripts:

```bash
# Windows
.\scripts\platform\windows.ps1

# Linux/macOS
chmod +x scripts/platform/linux.sh
./scripts/platform/linux.sh
```
