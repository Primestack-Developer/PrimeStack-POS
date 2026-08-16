@echo off
title PrimeStack 101.6 — Payment Processor
color 0A

echo.
echo  =========================================================
echo    PrimeStack 101.6 Payment Processor
echo    Payments. Simplified. Everywhere.
echo  =========================================================
echo.

powershell -Command "[Console]::Beep(800, 300)"

cd /d %~dp0

:: ── Verify .env exists ─────────────────────────────────────────────
if not exist ".env" (
    echo  [ERROR] .env file not found.
    pause
    exit /b 1
)

echo.
echo  [1/4] Checking MongoDB Atlas connection...
echo        Using cloud database - no local MongoDB needed.
timeout /t 2 /nobreak >nul

echo.
echo  [2/4] Starting Backend API on port 4000...
start "PrimeStack Backend :4000" cmd /k "cd /d %~dp0 && set PORT=4000 && npm run dev"

echo        Waiting for backend to start...
timeout /t 8 /nobreak >nul

echo.
echo  [3/4] Starting Dashboard on port 3001...
start "PrimeStack Dashboard :3001" cmd /k "cd /d %~dp0dashboard && set PORT=3001 && npm start"

echo        Waiting for dashboard to start...
timeout /t 15 /nobreak >nul

echo.
echo  [4/4] Opening Dashboard in browser...
start "" http://localhost:3001

echo.
echo  =========================================================
echo    PrimeStack is running!
echo.
echo    Dashboard:          http://localhost:3001
echo    Backend API:        http://localhost:4000
echo    Health check:       http://localhost:4000/health
echo    Stripe config:      http://localhost:4000/stripe/config
echo.
echo    LIVE (Render):
echo    Backend:            https://primestack-pos.onrender.com
echo    Dashboard:          https://primestack-dashboard.onrender.com
echo.
echo    Android app URL:    https://primestack-pos.onrender.com
echo  =========================================================
echo.

powershell -Command "[Console]::Beep(1000, 150); [Console]::Beep(1200, 150); [Console]::Beep(1500, 300)"
pause
