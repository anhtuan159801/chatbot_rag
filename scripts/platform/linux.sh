#!/bin/bash

echo "🚀 Starting Chatbot RAG on Linux..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

if [ ! -f backend/.env ]; then
    echo "⚠️  .env file not found. Copying from example..."
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo "⚠️  Please edit backend/.env with your API keys"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✓ Starting development server..."
cd backend
npm run dev
