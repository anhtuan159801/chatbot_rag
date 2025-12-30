# Platform-Specific Startup Scripts

## Linux

```bash
#!/bin/bash

echo "🚀 Starting Chatbot RAG on Linux..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "⚠️  .env file not found. Copying from example..."
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo "⚠️  Please edit backend/.env with your API keys"
    exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "✓ Starting development server..."
cd backend
npm run dev
```

## macOS

```bash
#!/bin/bash

echo "🚀 Starting Chatbot RAG on macOS..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Install with: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Check .env
if [ ! -f backend/.env ]; then
    echo "⚠️  .env file not found. Copying from example..."
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo "⚠️  Please edit backend/.env with your API keys"
    exit 1
fi

# Install dependencies
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start server
echo "✓ Starting development server..."
cd backend
npm run dev
```

## Windows (PowerShell)

```powershell
# Chatbot RAG - Windows Startup Script

Write-Host "🚀 Starting Chatbot RAG on Windows..." -ForegroundColor Green

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check .env
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  .env file not found. Copying from example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" -Destination "backend\.env"
    Write-Host "✓ Created backend\.env" -ForegroundColor Green
    Write-Host "⚠️  Please edit backend\.env with your API keys" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm install
}

# Start server
Write-Host "✓ Starting development server..." -ForegroundColor Green
cd backend
npm run dev
```

## Termux (Android)

```bash
#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Starting Chatbot RAG on Termux..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Install with: pkg install nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Check .env
if [ ! -f backend/.env ]; then
    echo "⚠️  .env file not found. Copying from example..."
    cp backend/.env.example backend/.env
    echo "✓ Created backend/.env"
    echo "⚠️  Please edit backend/.env with your API keys"
    exit 1
fi

# Install dependencies
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start server
echo "✓ Starting development server..."
cd backend
npm run dev
```

## Usage

### Linux/macOS/Termux

```bash
chmod +x scripts/platform/linux.sh
./scripts/platform/linux.sh
```

### Windows

```powershell
.\scripts\platform\windows.ps1
# or
powershell -ExecutionPolicy Bypass -File .\scripts\platform\windows.ps1
```

## Notes

- All scripts check for Node.js installation
- `.env` file is created from `.env.example` if missing
- Dependencies are installed automatically if `node_modules` doesn't exist
- Development server starts on `http://localhost:8080`
