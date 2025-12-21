FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Install TypeScript for compilation
RUN npm install -g typescript

# Compile all server-side TypeScript files to JavaScript
RUN npx tsc --project tsconfig.server.json

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]