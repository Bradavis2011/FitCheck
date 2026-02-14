@echo off
REM FitCheck Setup Script (Windows)
REM Quickly set up the development environment

echo.
echo 🚀 FitCheck Setup
echo ==================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ first.
    exit /b 1
)

node --version
echo ✅ Node.js found
echo.

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd fitcheck-api
call npm install

if not exist .env (
    echo ⚠️  .env file not found in fitcheck-api/
    echo Please create one from .env.example and add your OPENAI_API_KEY
    exit /b 1
)

findstr "sk-your-openai-api-key-here" .env >nul
if %ERRORLEVEL% equ 0 (
    echo ⚠️  Please update OPENAI_API_KEY in fitcheck-api/.env
    exit /b 1
)

echo ✅ Backend dependencies installed
echo.

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd ..\fitcheck-app
call npm install --legacy-peer-deps

echo ✅ Frontend dependencies installed
echo.

REM Setup database
echo 🗄️  Setting up database...
cd ..\fitcheck-api

echo Generating Prisma client...
call npm run db:generate

echo Running database migrations...
call npm run db:push

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Start backend:  cd fitcheck-api ^&^& npm run dev
echo 2. Start frontend: cd fitcheck-app ^&^& npm start
echo.
echo See QUICKSTART.md for more details.
