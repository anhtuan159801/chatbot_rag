# ============================================================================
# Dockerfile - Simple Backend Build
# ============================================================================
# Author: System
# Description: Build backend only, copy pre-built frontend
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# ============================================================================
# Stage 1: Build Backend
# ============================================================================
FROM base AS build-backend

COPY backend/package*.json ./backend/
COPY backend/tsconfig*.json ./backend/
COPY backend/src ./backend/src/
COPY backend/services ./backend/services/
COPY backend/middleware ./backend/middleware/
COPY backend/migrations ./backend/migrations/
COPY backend/server.ts ./backend/

RUN cd backend && npm ci --ignore-scripts --no-audit
RUN cd backend && npx tsc

# ============================================================================
# Stage 2: Production Image
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init curl

COPY backend/package*.json ./
RUN npm ci --only=production --ignore-scripts --no-audit

COPY --from=build-backend /app/backend/dist-server ./backend/dist-server
COPY --from=build-backend /app/backend/services ./services
COPY --from=build-backend /app/backend/middleware ./middleware

RUN addgroup -g node -S && adduser -S -G node node
RUN chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/dist-server/server.js"]
