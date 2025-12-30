# ============================================================================
# Dockerfile - Fixed Multi-Stage Build
# ============================================================================
# Author: System
# Description: Production-ready Docker image with proper path handling
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM base AS deps

RUN apk add --no-cache python3 make g++ libc6-compat

# Copy root package.json (for workspaces)
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ============================================================================
# Stage 2: Build Backend
# ============================================================================
FROM base AS build-backend

# Copy backend package files
COPY backend/package*.json ./backend/

# Copy backend source
COPY backend/src ./backend/src/
COPY backend/services ./backend/services/
COPY backend/middleware ./backend/middleware/
COPY backend/migrations ./backend/migrations/
COPY backend/tsconfig*.json ./backend/

# Install backend dependencies and build
RUN cd backend && npm ci --ignore-scripts --no-audit --no-fund
RUN cd backend && npx tsc --project tsconfig.server.json

# ============================================================================
# Stage 3: Build Frontend
# ============================================================================
FROM base AS build-frontend

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Copy frontend source
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src/

# Install frontend dependencies and build
RUN cd frontend && npm ci --ignore-scripts --no-audit --no-fund
RUN cd frontend && npm run build

# ============================================================================
# Stage 4: Production Image
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init curl

# Copy backend package.json
COPY backend/package*.json ./

# Install only production dependencies for backend
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

# Copy compiled backend code
COPY --from=build-backend /app/backend/dist-server ./dist-server
COPY --from=build-backend /app/backend/services ./services
COPY --from=build-backend /app/backend/middleware ./middleware
COPY --from=build-backend /app/backend/migrations ./migrations

# Copy compiled frontend code
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Create non-root user for security
RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist-server/server.js"]
