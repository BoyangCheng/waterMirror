@echo off
chcp 65001 >nul
REM ============================================================
REM  WaterMirror - Start dev server (Windows)
REM ============================================================
cd /d "%~dp0\.."

if not exist "node_modules" (
    echo [WARN] node_modules not found. Run setup.bat first.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [WARN] .env not found. Run setup.bat first and fill in secrets.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Starting WaterMirror dev server
echo   URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo ================================================
echo.

call npm run dev
