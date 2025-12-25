@echo off
REM 🥝 Kiwi Frontend Server
REM Start the Next.js frontend development server

cd /d "%~dp0\.."

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   🥝 Kiwi Frontend Server
echo ════════════════════════════════════════════════════════════════════════════════
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] Dependencies not installed. Installing...
    echo.
    call npm install
    echo.
)

echo [OK] Dependencies verified
echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo Starting Next.js server on http://localhost:3000
echo ════════════════════════════════════════════════════════════════════════════════
echo.

call npm run dev
