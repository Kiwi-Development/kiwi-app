import os
import base64
import asyncio
import threading
import time
import subprocess
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import browser_controller
import sys
import traceback
import logging
from datetime import datetime

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

app = FastAPI(title="Kiwi Backend API", version="1.0.0")
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Enable CORS for all routes
# In production, set ALLOWED_ORIGINS environment variable with comma-separated origins
# Note: Remove trailing slashes from URLs for proper CORS matching
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
# Split by comma and strip whitespace/trailing slashes
ALLOWED_ORIGINS = [origin.strip().rstrip('/') for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a dedicated event loop for Playwright to run in a separate thread
playwright_loop = asyncio.new_event_loop()

def start_playwright_loop():
    """Starts the dedicated event loop."""
    asyncio.set_event_loop(playwright_loop)
    playwright_loop.run_forever()

# Start the loop in a daemon thread
t = threading.Thread(target=start_playwright_loop, daemon=True)
t.start()

def run_async(coro):
    """Helper to run an async coroutine in the Playwright loop and wait for the result."""
    future = asyncio.run_coroutine_threadsafe(coro, playwright_loop)
    return future.result()

# Dictionary to store session timers
session_timers = {}

def schedule_session_timeout(session_id):
    """Schedules the browser session to close after 5 minutes."""
    global session_timers
    
    # Cancel existing timer if any (though for a new session ID this shouldn't happen)
    if session_id in session_timers:
        session_timers[session_id].cancel()
        
    def timeout_handler():
        print(f"Session {session_id} timed out. Closing browser tab...")
        run_async(browser_controller.close_session(session_id))
        if session_id in session_timers:
            del session_timers[session_id]
        
    # 5 minutes = 300 seconds
    timer = threading.Timer(300, timeout_handler)
    session_timers[session_id] = timer
    timer.start()
    print(f"Scheduled session timeout for {session_id} in 5 minutes.")

# Pydantic models for request validation
class StartSessionRequest(BaseModel):
    url: str

class ClickRequest(BaseModel):
    x: int
    y: int
    sessionId: str

class ScreenshotRequest(BaseModel):
    sessionId: str

class ExtractContextRequest(BaseModel):
    sessionId: str

class FigmaMetadataRequest(BaseModel):
    url: str
    apiToken: Optional[str] = None

@app.get("/health")
async def health():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "kiwi-backend"
    }

@app.get("/health/ready")
async def readiness():
    """Readiness probe - checks if service is ready to accept traffic"""
    try:
        # Check if Playwright loop is running
        # This is a simple check - you can add more sophisticated checks
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "kiwi-backend",
            "checks": {
                "playwright_loop": "running"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@app.get("/health/live")
async def liveness():
    """Liveness probe - checks if service is alive"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "kiwi-backend",
        "uptime": "running"
    }

@app.post("/start")
async def start_session(request: StartSessionRequest):
    """Start a new browser session"""
    url = request.url
    
    try:
        print(f"Starting new session with URL: {url}")
        session_id = run_async(browser_controller.start_session(url))
        schedule_session_timeout(session_id)
        return {"status": "ok", "message": "Session started", "sessionId": session_id}
    except Exception as e:
        logger.error(f"Error starting session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

@app.post("/click")
async def click(request: ClickRequest):
    """Click at specified coordinates"""
    x = request.x
    y = request.y
    session_id = request.sessionId
    
    try:
        old_url = run_async(browser_controller.get_current_url(session_id))
        run_async(browser_controller.click_at(session_id, x, y))
        new_url = run_async(browser_controller.get_current_url(session_id))

        if old_url == new_url:
            return {"status": "click_failed", "message": "Click failed to hit button. Try again."}
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error clicking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

@app.post("/screenshot")
async def screenshot(request: ScreenshotRequest):
    """Take a screenshot of the current page"""
    session_id = request.sessionId

    try:
        img_bytes = run_async(browser_controller.take_screenshot(session_id))
        
        if not img_bytes:
            raise HTTPException(
                status_code=500,
                detail={"status": "error", "message": "Failed to capture screenshot"}
            )
            
        # Encode to base64
        b64_string = base64.b64encode(img_bytes).decode('utf-8')
        
        return {
            "status": "ok",
            "screenshot": b64_string
        }
    except HTTPException:
        raise
    except Exception as e:
        error_details = traceback.format_exc()
        # This WILL show up in logs because it's an exception
        logger.error(f"ERROR: {error_details}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": str(e),
                "details": error_details
            }
        )

@app.post("/extract-context")
async def extract_context(request: ExtractContextRequest):
    """Extract semantic context (DOM, accessibility, metadata) from current page"""
    session_id = request.sessionId
    
    try:
        context = run_async(browser_controller.extract_context(session_id))
        return {
            "status": "ok",
            "context": context
        }
    except Exception as e:
        logger.error(f"Error extracting context: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e)}
        )

@app.post("/figma-metadata")
async def figma_metadata(request: FigmaMetadataRequest):
    """Fetch Figma metadata for a given Figma URL (optional enhancement)
    
    For public Figma prototypes, this is optional. If no API token is provided,
    the system will use DOM/A11y extraction instead, which works for any website.
    """
    url = request.url
    api_token = request.apiToken or os.environ.get('FIGMA_API_TOKEN')
    
    try:
        import figma_client
        
        if not figma_client.is_figma_url(url):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "message": "URL is not a valid Figma URL"}
            )
        
        file_key = figma_client.extract_file_key_from_url(url)
        if not file_key:
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "message": "Could not extract file key from URL"}
            )
        
        # Fetch metadata (will return minimal response if no token)
        metadata = figma_client.fetch_figma_metadata(file_key, api_token)
        
        return {
            "status": "ok",
            "metadata": metadata,
            "enhanced": api_token is not None and metadata.get("metadata_available", False)  # Indicates if full metadata is available
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Figma metadata: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e)}
        )

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', 5001))
    uvicorn.run(app, host='0.0.0.0', port=port)
