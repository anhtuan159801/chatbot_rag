FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --ignore-scripts --no-audit --no-fund --workspace=false

COPY backend ./backend/

ENV GEMINI_API_KEY=AIzaSyDUPGh8lTmow0UObimcKukJCdMDSJk6H_I
ENV GEMINI_MODEL=gemini-3.0-flash
ENV PORT=8080
ENV NODE_ENV=development

EXPOSE 8080

CMD ["npx", "tsx", "backend/server.ts"]
