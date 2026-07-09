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

:: ── Set working directory to project root ──────────────────────────
cd /d "%~dp0"

:: ── Verify .env exists ─────────────────────────────────────────────
if not exist ".env" (
    echo  [ERROR] .env file not found.
    echo  Copy .env.example to .env and fill in your values.
    pause
    exit /b 1
)

echo.
echo  [1/4] Checking MongoDB...
echo        Make sure MongoDB is running on localhost:27017
echo        or set MONGO_URI in .env to your connection string.
timeout /t 2 /nobreak >nul

echo.
echo  [2/4] Starting Backend API (port 4000)...
start "PrimeStack Backend :4000" cmd /k "cd /d %~dp0 && npm run dev"

echo        Waiting for backend to start...
timeout /t 6 /nobreak >nul

echo.
echo  [3/4] Starting Dashboard (port 3001)...
start "PrimeStack Dashboard :3001" cmd /k "cd /d %~dp0dashboard && set PORT=3001 && npm start"

echo        Waiting for dashboard to start...
timeout /t 12 /nobreak >nul

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
echo.
echo    Key endpoints:
echo    Transactions:       http://localhost:4000/transactions
echo    Wallets:            http://localhost:4000/wallet/{merchant_id}
echo    Payouts (admin):    http://localhost:4000/admin/payouts
echo    Offline queue:      http://localhost:4000/offline/status
echo    Issuers:            http://localhost:4000/issuer
echo    Cash-outs:          http://localhost:4000/cashout/all
echo.
echo    Android POS:        http://10.0.2.2:4000  (emulator)
echo                        http://{your-ip}:4000  (real device)
echo  =========================================================
echo.

powershell -Command "[Console]::Beep(1000, 150); [Console]::Beep(1200, 150); [Console]::Beep(1500, 300)"
pause
