@echo off
echo ========================================================
echo        Starting MistriJi Local Dev Environment
echo ========================================================
echo.

echo Cleaning up any old process on port 3002...
powershell -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"

echo Starting Web, Admin, and API services...
echo.

:: Launch Web App, Admin App, and API Server
start "MistriJi Web App" cmd /k "npm run dev:web"
start "MistriJi Admin Portal" cmd /k "npm run dev:admin"
start "MistriJi Auth & Backend API" cmd /k "npm run dev:api"

echo.
echo All services are launching in separate windows!
echo - Web App:      http://localhost:3000
echo - Admin Portal: http://localhost:5173
echo - Backend API:  http://localhost:3002
echo.
pause
