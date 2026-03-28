@echo off
echo Starting dev environment...
echo Docker containers must be running (run start.bat first)
echo.

:: Option 1: Frontend only (uses Docker API on port 3001)
:: Open two terminals and run each section

echo === FRONTEND DEV (hot-reload on http://localhost:5173) ===
echo cd frontend ^&^& npm install ^&^& npm run dev
echo.
echo === BACKEND DEV (optional - runs locally on port 3000) ===
echo cd backend ^&^& npm install ^&^& npm run dev
echo.

:: Start frontend in new window
start "Frontend Dev" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Uncomment to also start backend locally:
:: start "Backend Dev" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Frontend dev server starting at http://localhost:5173
echo (Uses Docker API at localhost:3001)
pause
