@echo off
REM 🥝 Kiwi Backend Server
REM Start the FastAPI backend server with Playwright browser automation

cd /d "%~dp0\..\backend"

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   🥝 Kiwi Backend Server
echo ════════════════════════════════════════════════════════════════════════════════
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found
    echo.
    echo Please run setup first:
    echo   cd backend
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo   playwright install
    echo.
    pause
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if dependencies are installed
python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo [WARNING] Dependencies not installed. Installing...
    echo.
    pip install -r requirements.txt
    echo.
    echo Installing Playwright browsers...
    playwright install
    echo.
)

echo [OK] Virtual environment activated
echo [OK] Dependencies verified
echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo Starting FastAPI server on http://localhost:5001
echo ════════════════════════════════════════════════════════════════════════════════
echo.

python server.py
