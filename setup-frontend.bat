@echo off
echo ========================================
echo FitCheck Frontend Setup
echo ========================================
echo.

cd /d "%~dp0\fitcheck-app"

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup complete! Starting Expo...
echo ========================================
echo.
call npm start

pause
