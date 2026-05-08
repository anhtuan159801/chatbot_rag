FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --ignore-scripts --no-audit --no-fund --workspace=false

COPY backend ./backend/
COPY .env ./.env

EXPOSE 8080

CMD ["npx", "tsx", "backend/server.ts"]
