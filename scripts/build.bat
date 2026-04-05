@echo off
chcp 65001 >nul
REM ============================================================
REM  WaterMirror - Production build (Windows)
REM ============================================================
cd /d "%~dp0\.."

if not exist "node_modules" (
    echo [WARN] node_modules not found. Run setup.bat first.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Building production bundle...
echo ================================================
echo.

call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Build complete! Run start.bat to launch.
echo ================================================
echo.
pause
