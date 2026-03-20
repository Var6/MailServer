@echo off
title Enterprise Mail Server
color 0A
cd /d "%~dp0"

echo.
echo  ============================================================
echo   Enterprise Mail Server  ^|  Backend + Next.js Frontend
echo  ============================================================
echo.

:: Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo          Install from: https://www.python.org/downloads/
    pause & exit /b 1
)

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [WARN] Node.js not found - frontend will be skipped.
    echo         Install from: https://nodejs.org/
    echo.
    python run.py --backend-only %*
) else (
    python run.py %*
)

if errorlevel 1 (
    echo.
    echo  [ERROR] Server stopped with an error. See output above.
)
pause
