#!/bin/bash

# FitCheck Setup Script
# Quickly set up the development environment

echo "🚀 FitCheck Setup"
echo "=================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

echo "✅ npm $(npm --version) found"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd fitcheck-api
npm install

# Check for .env
if [ ! -f .env ]; then
    echo "⚠️  .env file not found in fitcheck-api/"
    echo "Please create one from .env.example and add your OPENAI_API_KEY"
    exit 1
fi

# Check for OPENAI_API_KEY
if grep -q "sk-your-openai-api-key-here" .env; then
    echo "⚠️  Please update OPENAI_API_KEY in fitcheck-api/.env"
    exit 1
fi

echo "✅ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../fitcheck-app
npm install --legacy-peer-deps

echo "✅ Frontend dependencies installed"
echo ""

# Setup database
echo "🗄️  Setting up database..."
cd ../fitcheck-api

# Check if PostgreSQL is running (simple check)
if command -v pg_isready &> /dev/null; then
    if pg_isready &> /dev/null; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL not running. Start it or use Supabase."
    fi
else
    echo "ℹ️  PostgreSQL check skipped (pg_isready not found)"
fi

# Run database migrations
echo "Running database migrations..."
npm run db:push
npm run db:generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start backend:  cd fitcheck-api && npm run dev"
echo "2. Start frontend: cd fitcheck-app && npm start"
echo ""
echo "See QUICKSTART.md for more details."
