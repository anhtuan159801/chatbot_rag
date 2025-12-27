FROM node:20-alpine

WORKDIR /app

# Install build dependencies for alpine
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (both production and development) for building (no cache)
RUN npm ci --no-cache

# Copy source code
COPY . .

# Build the frontend first (creates dist folder) (no cache)
RUN npm run build --no-cache

# Force rebuild server-side TypeScript files (no cache for JS files)
# Also invalidate npm ci cache (no cache)
RUN rm -rf node_modules/.vite dist-server && npm ci --no-cache && npx tsc --project tsconfig.server.json

# Create production environment file if not exists
RUN if [ ! -f .env ]; then touch .env; fi

# Set default port
ENV PORT=8000

# Expose the port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "dist-server/server.js"]

