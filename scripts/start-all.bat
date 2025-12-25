@echo off
REM 🥝 Kiwi Development Servers
REM Start both frontend and backend servers in separate windows

cd /d "%~dp0\.."

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   🥝 Kiwi Development Environment
echo ════════════════════════════════════════════════════════════════════════════════
echo.

echo Starting backend server...
start "Kiwi Backend" cmd /k "cd /d %~dp0\..\backend && call venv\Scripts\activate.bat && python server.py"

REM Wait a moment
timeout /t 3 /nobreak >nul

echo Starting frontend server...
start "Kiwi Frontend" cmd /k "cd /d %~dp0\.. && call npm run dev"

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo [OK] Development servers started
echo ════════════════════════════════════════════════════════════════════════════════
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5001
echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo.
echo Servers are running in separate windows.
echo Close the windows to stop the servers.
echo.
pause
