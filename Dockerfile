# ============================================================================
# Dockerfile - Optimized Multi-Stage Build
# ============================================================================
# Author: System
# Description: Production-ready Docker image with caching and security
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM base AS deps

RUN apk add --no-cache python3 make g++ libc6-compat

COPY backend/package*.json backend/tsconfig*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ============================================================================
# Stage 2: Build Backend
# ============================================================================
FROM base AS build-backend

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package*.json backend/tsconfig*.json ./
COPY backend/tsconfig*.json ./
COPY backend/src ./src
COPY backend/services ./services
COPY backend/middleware ./middleware

RUN npx tsc --project tsconfig.server.json

# ============================================================================
# Stage 3: Build Frontend
# ============================================================================
FROM base AS build-frontend

COPY --from=deps /app/node_modules ./node_modules
COPY frontend/package*.json frontend/vite.config.ts frontend/tsconfig*.json ./
COPY frontend/src ./src
COPY frontend/index.html ./

RUN npm run build

# ============================================================================
# Stage 4: Production Image
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init curl

COPY backend/package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

COPY --from=build-backend /app/dist-server ./dist-server
COPY --from=build-backend /app/services ./services
COPY --from=build-backend /app/middleware ./middleware
COPY --from=build-frontend /app/dist ./frontend/dist

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
