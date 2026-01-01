# ============================================================================
# Dockerfile - Final optimized version
# ============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# Stage 1: Build
FROM base AS build
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY backend ./backend/
COPY shared ./shared/
RUN cd backend && npm run build

COPY frontend ./frontend/
RUN cd frontend && npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init curl

COPY backend/package*.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=build /app/backend/dist-server ./backend/dist-server
COPY --from=build /app/backend/services ./backend/services
COPY --from=build /app/backend/middleware ./backend/middleware
COPY --from=build /app/backend/migrations ./backend/migrations
COPY --from=build /app/frontend/dist ./frontend/dist

RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["dumb-init", "node", "backend/dist-server/server.js"]
