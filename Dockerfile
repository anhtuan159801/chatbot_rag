FROM node:20-alpine

WORKDIR /app

# Install build dependencies for alpine
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (both production and development) for building
RUN npm ci

# Copy source code
COPY . .

# Build the frontend first (creates dist folder)
RUN npm run build

# Compile server-side TypeScript files to JavaScript (creates dist-server folder)
RUN npx tsc --project tsconfig.server.json

# Remove development dependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
