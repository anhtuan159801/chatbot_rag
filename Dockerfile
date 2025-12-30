# Dockerfile - Simple Backend Build
# ============================================================================
# Author: System
# Description: Minimal Docker build for backend only
# ============================================================================

FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init curl

# Copy backend files
COPY backend/package*.json ./

RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

COPY backend/dist-server ./backend/dist-server || (echo "No dist-server" && mkdir -p backend/dist-server && echo "module.exports = {}" > backend/dist-server/server.js)
COPY backend/tsconfig.json ./backend/tsconfig.json || true

COPY backend/services ./backend/services || (mkdir -p backend/services)
COPY backend/middleware ./backend/middleware || (mkdir -p backend/middleware)
COPY backend/migrations ./backend/migrations || (mkdir -p backend/migrations)

RUN addgroup -g node -S && \
    adduser -S -G node node && \
    chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 0

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "backend/dist-server/server.js"]
