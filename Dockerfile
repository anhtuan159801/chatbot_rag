# ============================================================================
# Dockerfile - Proper Multi-Stage Build
# ============================================================================
# Author: System
# Description: Production-ready Docker following opencode.md guidelines
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Build
# ============================================================================
FROM base AS build

RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files (root for workspaces)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies
RUN npm ci --ignore-scripts --no-audit --no-fund

# Copy and build backend
COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src/
COPY backend/services ./backend/services/
COPY backend/middleware ./backend/middleware/
COPY backend/migrations ./backend/migrations/
COPY backend/server.ts ./backend/

RUN cd backend && npm run build

# Copy and build frontend
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/components ./frontend/components/
COPY frontend/services ./frontend/services/
COPY frontend/App.tsx ./frontend/

RUN cd frontend && npm run build

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init curl

# Copy backend package.json
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

# Copy built backend
COPY --from=build /app/backend/dist-server ./backend/dist-server
COPY --from=build /app/backend/services ./backend/services
COPY --from=build /app/backend/middleware ./backend/middleware
COPY --from=build /app/backend/migrations ./backend/migrations

# Copy built frontend
COPY --from=build /app/frontend/dist ./frontend/dist

RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/dist-server/server.js"]
