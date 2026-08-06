@echo off
title PrimeStack 101.6 — Payment Processor
color 0A

set "BACKEND_HOST=localhost"
set "BACKEND_PORT=4000"
set "DASHBOARD_HOST=localhost"
set "DASHBOARD_PORT=3000"

echo.
echo  =========================================================
echo    PrimeStack 101.6 Payment Processor
echo    Payments. Simplified. Everywhere.
echo  =========================================================
echo.
echo  [1/4] Checking MongoDB...
echo        Make sure MongoDB is running on localhost:27017
echo        or set MONGO_URI in .env to your connection string.
timeout /t 2 /nobreak >nul

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
echo  [2/4] Starting Backend API (%BACKEND_HOST%:%BACKEND_PORT%)...
start "PrimeStack Backend :%BACKEND_PORT%" cmd /k "cd /d %~dp0 && set PORT=%BACKEND_PORT% && npm run dev"

echo        Waiting for backend to start...
timeout /t 6 /nobreak >nul

echo.
echo  [3/4] Starting Dashboard (%DASHBOARD_HOST%:%DASHBOARD_PORT%)...
start "PrimeStack Dashboard :%DASHBOARD_PORT%" cmd /k "cd /d %~dp0dashboard && set PORT=%DASHBOARD_PORT% && set HOST=%DASHBOARD_HOST% && npm start"

echo        Waiting for dashboard to start...
timeout /t 12 /nobreak >nul

echo.
echo  [4/4] Opening Dashboard in browser...
start "" http://%DASHBOARD_HOST%:%DASHBOARD_PORT%

echo.
echo  =========================================================
echo    PrimeStack is running!
echo.
echo    Dashboard:          http://%DASHBOARD_HOST%:%DASHBOARD_PORT%
echo    Backend API:        http://%BACKEND_HOST%:%BACKEND_PORT%
echo    Health check:       http://%BACKEND_HOST%:%BACKEND_PORT%/health
echo.
echo    Key endpoints:
echo    Transactions:       http://%BACKEND_HOST%:%BACKEND_PORT%/transactions
echo    Wallets:            http://%BACKEND_HOST%:%BACKEND_PORT%/wallet/{merchant_id}
echo    Payouts (admin):    http://%BACKEND_HOST%:%BACKEND_PORT%/admin/payouts
echo    Offline queue:      http://%BACKEND_HOST%:%BACKEND_PORT%/offline/status
echo    Issuers:            http://%BACKEND_HOST%:%BACKEND_PORT%/issuer
echo    Cash-outs:          http://%BACKEND_HOST%:%BACKEND_PORT%/cashout/all
echo.
echo    Android POS:        http://10.0.2.2:%BACKEND_PORT%  (emulator)
echo                        http://{your-ip}:%BACKEND_PORT%  (real device)
echo  =========================================================
echo.

powershell -Command "[Console]::Beep(1000, 150); [Console]::Beep(1200, 150); [Console]::Beep(1500, 300)"
pause
