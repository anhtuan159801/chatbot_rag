FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
COPY backend/package-lock.json ./backend/

RUN cd backend && npm install --ignore-scripts --no-audit --no-fund

COPY backend ./backend/

ENV GEMINI_API_KEY=AIzaSyDUPGh8lTmow0UObimcKukJCdMDSJk6H_I
ENV GEMINI_MODEL=gemini-3.0-flash
ENV PORT=8080

EXPOSE 8080

CMD ["npx", "tsx", "backend/server.ts"]
