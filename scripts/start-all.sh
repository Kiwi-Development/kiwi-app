#!/bin/bash

# 🥝 Kiwi Development Servers
# Start both frontend and backend servers simultaneously

cd "$(dirname "$0")/.." || exit 1

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🥝 Kiwi Development Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ Servers stopped${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit
}

trap cleanup INT TERM

# Start backend with prefix
echo -e "${CYAN}[1/2] Starting backend server...${NC}"
(
    cd backend
    if [ -d "venv" ]; then
        source venv/bin/activate
        python server.py 2>&1 | while IFS= read -r line; do 
            echo -e "${MAGENTA}[BACKEND]${NC} $line"
        done
    else
        echo -e "${RED}[BACKEND] ERROR: Virtual environment not found${NC}"
        exit 1
    fi
) &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend with prefix
echo -e "${CYAN}[2/2] Starting frontend server...${NC}"
npm run dev 2>&1 | while IFS= read -r line; do 
    echo -e "${CYAN}[FRONTEND]${NC} $line"
done &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Development servers started${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "  ${BLUE}Backend:${NC}  http://localhost:5001"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Server logs are displayed below with colored prefixes.${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers.${NC}"
echo ""

# Wait for processes - logs will appear in real-time in the terminal
wait
