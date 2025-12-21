FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install TypeScript and type definitions for compilation
RUN npm install -g typescript
RUN npm install --save-dev @types/express

# Copy source code
COPY . .

# Compile all server-side TypeScript files to JavaScript
RUN npx tsc --project tsconfig.server.json

# Copy compiled server files to the correct location
RUN cp -r dist-server/services/* services/ && rm -rf dist-server

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]