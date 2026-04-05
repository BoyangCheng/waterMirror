@echo off
chcp 65001 >nul
REM ============================================================
REM  WaterMirror - Start production server (Windows)
REM ============================================================
cd /d "%~dp0\.."

if not exist ".next" (
    echo [WARN] .next not found. Run build.bat first.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Starting WaterMirror production server
echo   URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo ================================================
echo.

call npm run start
