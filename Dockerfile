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

# Compile the apiProxy TypeScript file to JavaScript in place
RUN npx tsc services/apiProxy.ts --outDir services --module es2020 --target es2020 --moduleResolution node --esModuleInterop

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]