# ============================================================================
# Dockerfile - Build Both Backend and Frontend
# ============================================================================
# Author: System
# Description: Complete build with proper dependency management
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Install Dependencies
# ============================================================================
FROM base AS deps

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ============================================================================
# Stage 2: Build Backend
# ============================================================================
FROM base AS build-backend

COPY --from=deps /app/node_modules ./node_modules

COPY backend/package*.json ./backend/
COPY backend/tsconfig*.json ./backend/

RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npx tsc

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
COPY frontend/services ./frontend/services/
COPY frontend/components ./frontend/components/
COPY frontend/App.tsx ./frontend/

RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npm run build

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
COPY --from=build-backend /app/backend/services ./services
COPY --from=build-backend /app/backend/middleware ./middleware
COPY --from=build-backend /app/backend/migrations ./migrations

COPY --from=build-frontend /app/frontend/dist ./frontend/dist

RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/dist-server/server.js"]
