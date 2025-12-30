# ============================================================================
# Dockerfile - Minimal Build (Backend Only)
# ============================================================================
# Author: System
# Description: Simplified Docker build focusing only on backend
# ============================================================================

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init curl

COPY backend/package*.json ./

RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

COPY backend/dist-server ./dist-server
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/services ./services/
COPY backend/middleware ./middleware/
COPY backend/migrations ./migrations/
COPY backend/src ./src/

RUN addgroup -g node -S && adduser -S -G node node && \
    chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist-server/server.js"]
