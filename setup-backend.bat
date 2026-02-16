@echo off
echo ========================================
echo FitCheck Backend Setup
echo ========================================
echo.

cd /d "%~dp0\fitcheck-api"

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: prisma generate failed
    pause
    exit /b 1
)

echo.
echo Pushing database schema...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERROR: prisma db push failed
    echo Make sure DATABASE_URL is set correctly in .env
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup complete! Starting server...
echo ========================================
echo.
call npm run dev

pause
