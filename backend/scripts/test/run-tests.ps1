# Test Setup Script for Windows
# Cài đặt dependencies và chạy tests

Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RAG CHATBOT TEST SETUP (Windows)" -ForegroundColor Cyan
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location backend

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "❌ .env file not found. Please create .env from .env.example" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing test dependencies..." -ForegroundColor Yellow
npm install --save-dev jest @types/jest ts-jest ts-node --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Jest dependencies" -ForegroundColor Red
    exit 1
}

npm install --save-dev @types/node @types/pg --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install type dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Generating Jest configuration..." -ForegroundColor Yellow
$jestConfig = @"
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    '!services/**/*.d.ts',
    '!services/**/*.test.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../shared/$1',
  },
  testTimeout: 30000,
  verbose: true,
};
"@
Set-Content -Path jest.config.js -Value $jestConfig

Write-Host ""
Write-Host "📁 Creating test directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path tests\fixtures | Out-Null
New-Item -ItemType Directory -Force -Path coverage | Out-Null

Write-Host ""
Write-Host "🔍 Running Integration Tests..." -ForegroundColor Yellow
npx ts-node tests\integration\runIntegrationTests.ts
$testExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($testExitCode -eq 0) {
    Write-Host "  ✅ ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  ❌ SOME TESTS FAILED" -ForegroundColor Red
}
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor Cyan

exit $testExitCode
