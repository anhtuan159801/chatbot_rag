# Chatbot RAG - Windows Startup Script

Write-Host "🚀 Starting Chatbot RAG on Windows..." -ForegroundColor Green

try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  .env file not found. Copying from example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" -Destination "backend\.env"
    Write-Host "✓ Created backend\.env" -ForegroundColor Green
    Write-Host "⚠️  Please edit backend\.env with your API keys" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm install
}

Write-Host "✓ Starting development server..." -ForegroundColor Green
cd backend
npm run dev
