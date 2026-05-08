FROM node:20-alpine
WORKDIR /app

COPY package*.json package-lock.json ./
COPY backend/package*.json backend/package-lock.json ./backend/
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY backend ./backend/

EXPOSE 8080

CMD ["npx", "tsx", "backend/server.ts"]
