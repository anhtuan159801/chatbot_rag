FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./backend/

RUN cd backend && npm install --ignore-scripts --no-audit --no-fund

COPY backend ./backend/

ENV GEMINI_MODEL=gemini-3-flash-preview
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "backend/server.ts"]
