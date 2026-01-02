import asyncio
from playwright.async_api import async_playwright
import subprocess
import sys
import os

import uuid

_playwright = None
_browser = None
_sessions = {}
_browsers_installed = False

async def ensure_browsers_installed():
    """Ensure Playwright browsers are installed (for Render compatibility)"""
    global _browsers_installed
    if _browsers_installed:
        return
    
    try:
        # Check if browsers are installed by trying to launch (async)
        test_playwright = await async_playwright().start()
        try:
            test_browser = await test_playwright.chromium.launch(headless=True, args=['--no-sandbox'])
            await test_browser.close()
            await test_playwright.stop()
            _browsers_installed = True
            print("Playwright browsers are already installed")
            return
        except Exception as launch_err:
            await test_playwright.stop()
            print(f"Browsers not available: {launch_err}")
        
        # If we get here, browsers aren't installed - try to install them using subprocess
        print("Playwright browsers not found, attempting to install...")
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
        )
        if result.returncode == 0:
            print("Successfully installed Playwright browsers")
            _browsers_installed = True
        else:
            print(f"Failed to install browsers. Return code: {result.returncode}")
            print(f"stdout: {result.stdout}")
            print(f"stderr: {result.stderr}")
    except Exception as e:
        print(f"Error checking/installing browsers: {e}")
        import traceback
        traceback.print_exc()

async def start_session(url: str) -> str:
    """
    Starts a new browser session.
    Ensures the browser is launched, opens a new page, and returns a session ID.
    """
    global _playwright, _browser, _sessions
    
    # Ensure browsers are installed before starting
    await ensure_browsers_installed()
    
    if not _playwright:
        print("Starting Playwright...")
        _playwright = await async_playwright().start()
        
    if not _browser:
        print("Launching Browser...")
        try:
            # Browser launch options optimized for Standard tier (1GB+ RAM)
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',  # Reduces shared memory usage
                    '--disable-gpu',  # Disable GPU (not needed in headless)
                    '--disable-extensions',  # Disable extensions
                    '--max_old_space_size=512',  # V8 heap size: 512MB (increased for Standard tier)
                    '--js-flags=--max-old-space-size=512',  # Additional V8 heap limit
                ]
            )
        except Exception as e:
            print(f"Error launching browser with memory-optimized args: {e}")
            # Try with minimal args if first attempt fails
            try:
                _browser = await _playwright.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--max_old_space_size=512',  # Increased for Standard tier
                    ]
                )
            except Exception as e2:
                print(f"Error launching browser with minimal args: {e2}")
                raise
        
    session_id = str(uuid.uuid4())
    print(f"Opening new page for session {session_id} and navigating to {url}...")
    
    page = await _browser.new_page()
    
    # Memory-optimized page settings
    # Block only heavy media resources (videos, large images) but allow essential resources
    async def route_handler(route):
        resource_type = route.request.resource_type
        # Block only heavy media, allow everything else (including stylesheets for proper rendering)
        if resource_type in ['media']:  # Block videos/audio only
            await route.abort()
        else:
            await route.continue_()
    
    await page.route('**/*', route_handler)
    
    # Set longer timeout for Figma prototypes which can take time to load
    page.set_default_timeout(120000)  # 2 minutes
    
    try:
        # Try with networkidle first (more reliable for interactive content)
        await page.goto(url, wait_until="networkidle", timeout=120000)
    except Exception as e:
        print(f"Navigation with networkidle timed out, trying with 'load' instead: {e}")
        try:
            # Fallback to 'load' which is less strict
            await page.goto(url, wait_until="load", timeout=120000)
        except Exception as e2:
            print(f"Navigation with 'load' also failed, trying 'domcontentloaded': {e2}")
            # Last resort: just wait for DOM to be ready
            await page.goto(url, wait_until="domcontentloaded", timeout=120000)
            # Give it a moment for any initial rendering
            await asyncio.sleep(2)
    
    _sessions[session_id] = page
    print(f"Session {session_id} started successfully.")
    return session_id

async def close_session(session_id: str):
    """
    Closes the specified browser session.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if page:
        print(f"Closing session {session_id}...")
        await page.close()
        del _sessions[session_id]
        print(f"Session {session_id} closed.")
    else:
        print(f"Session {session_id} not found or already closed.")

async def get_current_url(session_id: str) -> str:
    """
    Returns the current URL of the page for the given session.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if page and not page.is_closed():
        return page.url
    return ""

async def click_at(session_id: str, x: int, y: int) -> bool:
    """
    Clicks at the specified coordinates (x, y) and returns True if the page URL changed, False otherwise.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        return False

    print(f"Clicking at ({x}, {y}) for session {session_id}")
    try:
        # Inject visual indicator
        await page.evaluate("""
            ([x, y]) => {
                const dot = document.createElement('div');
                dot.style.position = 'absolute';
                dot.style.left = (x + window.scrollX) + 'px';
                dot.style.top = (y + window.scrollY) + 'px';
                dot.style.width = '20px';
                dot.style.height = '20px';
                dot.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                dot.style.borderRadius = '50%';
                dot.style.pointerEvents = 'none';
                dot.style.zIndex = '99999';
                dot.style.transform = 'translate(-50%, -50%)';
                dot.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
                document.body.appendChild(dot);
                
                setTimeout(() => {
                    dot.style.transition = 'opacity 0.5s';
                    dot.style.opacity = '0';
                    setTimeout(() => dot.remove(), 500);
                }, 5000);
            }
        """, [x, y])

        await asyncio.gather(
            page.mouse.click(x, y),
        )
    except Exception as e:
        print(f"An error occurred during click or navigation: {e}")
        return False

async def take_screenshot(session_id: str) -> bytes:
    """
    Takes a screenshot of the current page and returns the bytes.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if page and not page.is_closed():
        print(f"Taking screenshot for session {session_id}...")
        return await page.screenshot()
    else:
        print(f"Error: Session {session_id} not found or closed.")
        return b""

async def extract_context(session_id: str) -> dict:
    """
    Extracts semantic context (DOM, accessibility, metadata) from the current page.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        return {"error": "Session not found or closed"}
    
    try:
        import context_extractor
        print(f"Extracting context for session {session_id}...")
        context = await context_extractor.extract_semantic_context(page)
        return context
    except Exception as e:
        print(f"Error extracting context: {e}")
        return {"error": str(e)}
