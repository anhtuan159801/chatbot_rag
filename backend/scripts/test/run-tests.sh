#!/bin/bash

# Test Setup Script
# Cài đặt dependencies và chạy tests

set -e

echo "═════════════════════════════════════════════════════════"
echo "  RAG CHATBOT TEST SETUP"
echo "═════════════════════════════════════════════════════════"
echo ""

cd backend

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create .env from .env.example"
    exit 1
fi

echo "📦 Installing test dependencies..."
npm install --save-dev jest @types/jest ts-jest ts-node --silent
npm install --save-dev @types/node @types/pg --silent

echo ""
echo "📝 Generating Jest configuration..."
cat > jest.config.js << 'EOF'
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
EOF

echo ""
echo "📁 Creating test directories..."
mkdir -p tests/fixtures
mkdir -p coverage

echo ""
echo "🔍 Running Integration Tests..."
npx ts-node tests/integration/runIntegrationTests.ts

EXIT_CODE=$?

echo ""
echo "═════════════════════════════════════════════════════════"
if [ $EXIT_CODE -eq 0 ]; then
    echo "  ✅ ALL TESTS PASSED"
else
    echo "  ❌ SOME TESTS FAILED"
fi
echo "═════════════════════════════════════════════════════════"

exit $EXIT_CODE
