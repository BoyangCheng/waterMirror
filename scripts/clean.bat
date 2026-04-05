@echo off
chcp 65001 >nul
REM ============================================================
REM  WaterMirror - Clean build artifacts and dependencies
REM ============================================================
cd /d "%~dp0\.."

echo.
echo Will delete: .next, node_modules
set /p CONFIRM="Continue? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

if exist ".next" (
    echo [INFO] Removing .next ...
    rmdir /s /q ".next"
)

if exist "node_modules" (
    echo [INFO] Removing node_modules ...
    rmdir /s /q "node_modules"
)

echo.
echo [OK] Clean complete. Run setup.bat to reinstall.
echo.
pause
