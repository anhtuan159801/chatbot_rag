FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (both production and development)
RUN npm ci

# Copy source code
COPY . .

# Build the frontend first (creates dist folder)
RUN npm run build

# Compile server-side TypeScript files to JavaScript (creates dist-server folder)
RUN npx tsc --project tsconfig.server.json

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
