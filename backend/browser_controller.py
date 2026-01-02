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
    
    # Set timeout for Figma prototypes
    page.set_default_timeout(60000)  # 1 minute (reduced from 2 minutes)
    
    # For Figma prototypes, use 'domcontentloaded' first (fastest)
    # Figma constantly loads resources, so 'networkidle' may never trigger
    try:
        # Start with 'domcontentloaded' - fastest, good enough for Figma
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        # Give a brief moment for initial rendering (Figma needs this)
        await asyncio.sleep(1)  # Reduced from 2 seconds
    except Exception as e:
        print(f"Navigation with domcontentloaded failed, trying 'load' instead: {e}")
        try:
            # Fallback to 'load' if domcontentloaded fails
            await page.goto(url, wait_until="load", timeout=60000)
        except Exception as e2:
            print(f"Navigation with 'load' also failed, trying 'networkidle' as last resort: {e2}")
            # Last resort: try networkidle (slowest, but most reliable)
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)  # Shorter timeout for networkidle
            except Exception as e3:
                print(f"All navigation strategies failed: {e3}")
                # If all fail, at least we tried - the page might still be usable
                raise
    
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
    For Figma prototypes, tries to find and click the actual clickable element.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        return False

    print(f"Clicking at ({x}, {y}) for session {session_id}")
    try:
        # Get viewport info to account for scrolling and transforms
        viewport_info = await page.evaluate("""
            () => {
                return {
                    scrollX: window.scrollX || 0,
                    scrollY: window.scrollY || 0,
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight,
                    devicePixelRatio: window.devicePixelRatio || 1
                };
            }
        """)
        
        # Try to find clickable element using Playwright's element detection
        # This works better with iframes and cross-origin content
        try:
            # Use evaluate_handle to get element at point
            element_handle = await page.evaluate_handle(f"""
                () => {{
                    return document.elementFromPoint({x}, {y});
                }}
            """)
            
            # Check if we got a valid handle and convert to ElementHandle
            if element_handle:
                element = element_handle.as_element()
                if element:
                    # Try to get bounding box of the element
                    try:
                        box = await element.bounding_box()
                        if box:
                            # Use center of element for more reliable clicking
                            actual_x = int(box['x'] + box['width'] / 2)
                            actual_y = int(box['y'] + box['height'] / 2)
                            print(f"Found element, clicking center at ({actual_x}, {actual_y}) instead of ({x}, {y})")
                            
                            # Try to click the element directly (more reliable)
                            try:
                                await element.click(timeout=5000)
                                print(f"Successfully clicked element directly")
                                # Still show visual indicator
                                await _show_click_indicator(page, x, y, actual_x, actual_y)
                                return True
                            except Exception as click_err:
                                print(f"Element click failed, falling back to coordinate: {click_err}")
                                # Fall through to coordinate click
                    except Exception as box_err:
                        print(f"Could not get bounding box: {box_err}")
        except Exception as elem_err:
            print(f"Could not find element at point: {elem_err}")
        
        # Fallback: use provided coordinates (adjusted for viewport)
        actual_x = x
        actual_y = y
        
        # Show visual indicator
        await _show_click_indicator(page, x, y, actual_x, actual_y)
        
        # Perform the click at the actual coordinates
        await page.mouse.click(actual_x, actual_y)
        print(f"Clicked at coordinates ({actual_x}, {actual_y})")
        return True
        
    except Exception as e:
        print(f"An error occurred during click or navigation: {e}")
        import traceback
        traceback.print_exc()
        return False

async def _show_click_indicator(page, original_x, original_y, actual_x, actual_y):
    """Helper method to show visual click indicator"""
    await page.evaluate("""
        ([x, y, actualX, actualY]) => {
            // Create indicator at the actual click position
            const dot = document.createElement('div');
            dot.style.position = 'fixed'; // Use fixed to account for scrolling
            dot.style.left = actualX + 'px';
            dot.style.top = actualY + 'px';
            dot.style.width = '24px';
            dot.style.height = '24px';
            dot.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
            dot.style.borderRadius = '50%';
            dot.style.pointerEvents = 'none';
            dot.style.zIndex = '999999';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.boxShadow = '0 0 20px rgba(255, 0, 0, 1), 0 0 10px rgba(255, 0, 0, 0.6)';
            dot.style.border = '3px solid white';
            
            // Add pulse animation
            dot.style.animation = 'clickPulse 0.4s ease-out';
            
            // Add pulse keyframes if not already added
            if (!document.getElementById('click-indicator-styles')) {
                const style = document.createElement('style');
                style.id = 'click-indicator-styles';
                style.textContent = `
                    @keyframes clickPulse {
                        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.3; }
                        30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
                        100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(dot);
            
            // Also show original position if different (yellow dot)
            if (actualX !== x || actualY !== y) {
                const originalDot = document.createElement('div');
                originalDot.style.position = 'fixed';
                originalDot.style.left = x + 'px';
                originalDot.style.top = y + 'px';
                originalDot.style.width = '16px';
                originalDot.style.height = '16px';
                originalDot.style.backgroundColor = 'rgba(255, 255, 0, 0.7)';
                originalDot.style.borderRadius = '50%';
                originalDot.style.pointerEvents = 'none';
                originalDot.style.zIndex = '999998';
                originalDot.style.transform = 'translate(-50%, -50%)';
                originalDot.style.border = '2px solid rgba(255, 200, 0, 0.8)';
                document.body.appendChild(originalDot);
                
                setTimeout(() => originalDot.remove(), 2500);
            }
            
            // Remove indicator after animation
            setTimeout(() => {
                dot.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                dot.style.opacity = '0';
                dot.style.transform = 'translate(-50%, -50%) scale(1.8)';
                setTimeout(() => dot.remove(), 600);
            }, 2500);
        }
    """, [original_x, original_y, actual_x, actual_y])

async def take_screenshot(session_id: str) -> bytes:
    """
    Takes a screenshot of the current page and returns the bytes.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        raise ValueError(f"Session {session_id} not found or closed")
    
    try:
        print(f"Taking screenshot for session {session_id}...")
        # Add timeout to screenshot to prevent hanging
        screenshot_bytes = await asyncio.wait_for(
            page.screenshot(),
            timeout=10.0  # 10 second timeout
        )
        return screenshot_bytes
    except asyncio.TimeoutError:
        print(f"Error: Screenshot timeout for session {session_id}")
        raise ValueError(f"Screenshot timeout for session {session_id}")
    except Exception as e:
        print(f"Error taking screenshot for session {session_id}: {e}")
        import traceback
        traceback.print_exc()
        raise

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
