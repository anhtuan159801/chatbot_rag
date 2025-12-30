# ============================================================================
# Dockerfile - Correct Build Process
# ============================================================================
# Author: System
# Description: Production Docker build without path duplication
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Install Dependencies
# ============================================================================
FROM base AS deps

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci --ignore-scripts --no-audit --no-fund

# ============================================================================
# Stage 2: Build Backend
# ============================================================================
FROM base AS build-backend

COPY --from=deps /app/node_modules ./node_modules

COPY backend/package*.json ./backend/
COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src/
COPY backend/services ./backend/services/
COPY backend/middleware ./backend/middleware/
COPY backend/migrations ./backend/migrations/
COPY backend/server.ts ./backend/

RUN cd backend && npm ci --ignore-scripts --no-audit --no-fund
RUN cd backend && npx tsc --project tsconfig.json

# ============================================================================
# Stage 3: Build Frontend
# ============================================================================
FROM base AS build-frontend

COPY --from=deps /app/node_modules ./node_modules

COPY frontend/package*.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src/
COPY frontend/components ./frontend/components/
COPY frontend/services ./frontend/services/
COPY frontend/App.tsx ./frontend/

RUN cd frontend && npm ci --ignore-scripts --no-audit --no-fund
RUN cd frontend && npm run build

# ============================================================================
# Stage 4: Production
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init curl

COPY backend/package*.json ./
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

COPY --from=build-backend /app/backend/dist-server ./dist-server
COPY --from=build-backend /app/backend/tsconfig.json ./tsconfig.json

COPY --from=build-frontend /app/frontend/dist ./dist

RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/dist-server/server.js"]
