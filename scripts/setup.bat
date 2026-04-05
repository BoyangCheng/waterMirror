@echo off
chcp 65001 >nul
REM ============================================================
REM  WaterMirror - Setup script (Windows)
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

echo.
echo ================================================
echo   WaterMirror Setup (Windows)
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js: %NODE_VER%

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm: %NPM_VER%

if not exist ".env" (
    echo.
    echo [INFO] .env not found, copying from .env.example...
    copy ".env.example" ".env" >nul
    echo [OK] .env created. Please edit it and fill in the secrets.
) else (
    echo [OK] .env exists
)

echo.
echo [INFO] Installing npm dependencies (may take a few minutes)...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed

if exist "prisma\schema.prisma" (
    echo.
    echo [INFO] Generating Prisma client...
    call npx prisma generate
)

echo.
echo ================================================
echo   Setup complete! Next steps:
echo     1. Edit .env with your secrets
echo     2. Run scripts\dev.bat to start dev server
echo ================================================
echo.
pause
endlocal
