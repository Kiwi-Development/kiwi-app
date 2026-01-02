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
from datetime import datetime, timezone

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

# Log CORS configuration for debugging
logger.info(f"CORS configured with allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "HEAD", "OPTIONS"],  # Explicitly include HEAD and OPTIONS for CORS
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

# Maximum number of concurrent sessions to prevent memory issues
# Set to 4 for Standard tier (1GB+ RAM) - can handle more concurrent users
MAX_CONCURRENT_SESSIONS = 4

def is_session_valid(session_id: str) -> bool:
    """Check if a session exists in the sessions dictionary."""
    import browser_controller
    return session_id in browser_controller._sessions and browser_controller._sessions[session_id] is not None

def cleanup_old_sessions():
    """Closes the oldest sessions if we exceed MAX_CONCURRENT_SESSIONS."""
    global session_timers
    import browser_controller
    
    if len(session_timers) > MAX_CONCURRENT_SESSIONS:
        # Get oldest session (first in dict)
        oldest_session = next(iter(session_timers.keys()))
        print(f"Too many sessions ({len(session_timers)}), closing oldest: {oldest_session}")
        if oldest_session in session_timers:
            session_timers[oldest_session].cancel()
        run_async(browser_controller.close_session(oldest_session))
        if oldest_session in session_timers:
            del session_timers[oldest_session]

def schedule_session_timeout(session_id, reset_existing=False, start_immediately=True):
    """Schedules the browser session to close after a timeout period.
    
    Args:
        session_id: The session ID to schedule timeout for
        reset_existing: If True, reset the timeout for an existing session
        start_immediately: If False, don't start the timer yet (wait for first activity)
    """
    global session_timers
    
    # Verify session exists before scheduling timeout
    if session_id not in browser_controller._sessions:
        logger.warning(f"Cannot schedule timeout for session {session_id} - session not found in _sessions")
        return
    
    # Clean up old sessions if we have too many (but only if we're adding a new session)
    if not reset_existing:
        cleanup_old_sessions()
    
    # Handle existing timer
    if session_id in session_timers:
        if not reset_existing:
            # If timer exists and we're not resetting, check if it's running
            # If it's not running (was created but never started), start it now
            existing_timer = session_timers[session_id]
            if not existing_timer.is_alive() and start_immediately:
                existing_timer.start()
                timeout_minutes = int(os.getenv("SESSION_TIMEOUT_SECONDS", "3600")) // 60
                print(f"Started existing timeout timer for {session_id} (will timeout in {timeout_minutes} minutes).")
            return  # Don't reset if not requested
        # Cancel existing timer before creating new one
        session_timers[session_id].cancel()
        
    def timeout_handler():
        print(f"Session {session_id} timed out. Closing browser tab...")
        # Double-check session still exists before closing
        if session_id in browser_controller._sessions:
            run_async(browser_controller.close_session(session_id))
        if session_id in session_timers:
            del session_timers[session_id]
        
    # Get timeout from environment variable (default: 60 minutes for longer simulations)
    # Increased from 30 to 60 minutes to handle longer test runs and initialization delays
    timeout_seconds = int(os.getenv("SESSION_TIMEOUT_SECONDS", "3600"))  # 60 minutes default
    
    timer = threading.Timer(timeout_seconds, timeout_handler)
    session_timers[session_id] = timer
    
    # Only start the timer if requested (for new sessions, wait until first activity)
    if start_immediately:
        timer.start()
        timeout_minutes = timeout_seconds // 60
        print(f"Scheduled session timeout for {session_id} in {timeout_minutes} minutes ({timeout_seconds}s).")
    else:
        # Timer is created but not started - will be started on first activity
        print(f"Session timeout timer created for {session_id} (will start on first activity).")

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

@app.get("/")
@app.head("/")  # Explicitly allow HEAD for Render's health check
async def root():
    """Root endpoint - health check for Render load balancer"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "kiwi-backend",
            "message": "Kiwi Backend API is running. Use /health for health checks."
        }
    except Exception as e:
        logger.error(f"Error in root endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health():
    """Basic health check"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "kiwi-backend"
        }
    except Exception as e:
        logger.error(f"Error in health endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health/ready")
async def readiness():
    """Readiness probe - checks if service is ready to accept traffic"""
    try:
        # Check if Playwright loop is running
        # This is a simple check - you can add more sophisticated checks
        return {
            "status": "ready",
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "kiwi-backend",
        "uptime": "running"
    }

@app.post("/start")
async def start_session(request: StartSessionRequest):
    """Start a new browser session"""
    url = request.url
    
    try:
        # Check if we're at the session limit
        if len(session_timers) >= MAX_CONCURRENT_SESSIONS:
            logger.warning(f"Session limit reached ({MAX_CONCURRENT_SESSIONS}), cleaning up old sessions...")
            cleanup_old_sessions()
            # If still at limit after cleanup, return error
            if len(session_timers) >= MAX_CONCURRENT_SESSIONS:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "status": "error",
                        "message": f"Too many concurrent sessions (max {MAX_CONCURRENT_SESSIONS}). Please wait and try again.",
                        "code": "SESSION_LIMIT_EXCEEDED"
                    }
                )
        
        print(f"Starting new session with URL: {url} (active sessions: {len(session_timers)})")
        session_id = run_async(browser_controller.start_session(url))
        
        # Verify session was actually created before scheduling timeout
        if session_id not in browser_controller._sessions:
            logger.error(f"Session {session_id} was not properly created in _sessions dictionary")
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "message": "Session was created but not properly initialized. Please try again.",
                    "code": "SESSION_INIT_FAILED"
                }
            )
        
        # Schedule timeout with a grace period - don't start counting until first use
        # This prevents sessions from timing out during initialization
        # The timeout will be properly started on first activity (screenshot/click)
        schedule_session_timeout(session_id, start_immediately=False)
        logger.info(f"Session {session_id} started (timeout will start on first activity, active sessions: {len(session_timers)})")
        return {"status": "ok", "message": "Session started", "sessionId": session_id}
    except HTTPException:
        raise
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
        # Reset session timeout on activity (session is being used)
        # start_immediately=True ensures the timer starts if it wasn't started yet
        if session_id in session_timers:
            schedule_session_timeout(session_id, reset_existing=True, start_immediately=True)
        else:
            # First activity - start the timeout timer
            schedule_session_timeout(session_id, reset_existing=False, start_immediately=True)
        
        # Check if session exists and is valid before attempting click
        if not is_session_valid(session_id):
            logger.warning(f"Session {session_id} not found or invalid for click - may have timed out or been closed")
            raise HTTPException(
                status_code=410,  # 410 Gone - session no longer exists
                detail={
                    "status": "error",
                    "message": f"Session {session_id} not found or closed. It may have timed out.",
                    "code": "SESSION_NOT_FOUND"
                }
            )
        
        old_url = run_async(browser_controller.get_current_url(session_id))
        run_async(browser_controller.click_at(session_id, x, y))
        new_url = run_async(browser_controller.get_current_url(session_id))

        if old_url == new_url:
            return {"status": "click_failed", "message": "Click failed to hit button. Try again."}
        
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clicking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

@app.post("/screenshot")
async def screenshot(request: ScreenshotRequest):
    """Take a screenshot of the current page"""
    session_id = request.sessionId

    try:
        # Reset session timeout on activity (session is being used)
        # start_immediately=True ensures the timer starts if it wasn't started yet
        if session_id in session_timers:
            schedule_session_timeout(session_id, reset_existing=True, start_immediately=True)
        else:
            # First activity - start the timeout timer
            schedule_session_timeout(session_id, reset_existing=False, start_immediately=True)
        
        # Check if session exists and is valid before attempting screenshot
        import browser_controller
        if not is_session_valid(session_id):
            logger.warning(f"Session {session_id} not found or invalid - may have timed out or been closed")
            raise HTTPException(
                status_code=410,  # 410 Gone - session no longer exists
                detail={
                    "status": "error",
                    "message": f"Session {session_id} not found or closed. It may have timed out.",
                    "code": "SESSION_NOT_FOUND"
                }
            )
        
        try:
            img_bytes = run_async(browser_controller.take_screenshot(session_id))
        except ValueError as ve:
            # Handle screenshot timeout or session not found
            error_msg = str(ve)
            logger.warning(f"Screenshot failed for session {session_id}: {error_msg}")
            
            if "timeout" in error_msg.lower():
                raise HTTPException(
                    status_code=504,  # 504 Gateway Timeout
                    detail={
                        "status": "error",
                        "message": f"Screenshot timeout for session {session_id}. The page may be taking too long to render.",
                        "code": "SCREENSHOT_TIMEOUT"
                    }
                )
            else:
                # Session not found or closed
                raise HTTPException(
                    status_code=410,  # 410 Gone
                    detail={
                        "status": "error",
                        "message": error_msg,
                        "code": "SESSION_NOT_FOUND"
                    }
                )
        
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
