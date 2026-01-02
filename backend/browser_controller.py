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
            # Browser launch options optimized for memory-constrained environments
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',  # Reduces shared memory usage
                    '--disable-gpu',  # Disable GPU (not needed in headless)
                    '--disable-extensions',  # Disable extensions
                    '--disable-software-rasterizer',  # Disable software rasterization
                    '--disable-background-networking',  # Disable background networking
                    '--disable-background-timer-throttling',  # Disable background timers
                    '--disable-renderer-backgrounding',  # Disable renderer backgrounding
                    '--disable-backgrounding-occluded-windows',  # Disable backgrounding
                    '--disable-features=TranslateUI',  # Disable translation UI
                    '--disable-ipc-flooding-protection',  # Disable IPC flooding protection
                    '--memory-pressure-off',  # Turn off memory pressure
                    '--max_old_space_size=256',  # V8 heap size: 256MB (reduced for memory efficiency)
                    '--js-flags=--max-old-space-size=256',  # Additional V8 heap limit
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
                        '--disable-software-rasterizer',
                        '--max_old_space_size=256',  # Reduced for memory efficiency
                    ]
                )
            except Exception as e2:
                print(f"Error launching browser with minimal args: {e2}")
                raise
        
    session_id = str(uuid.uuid4())
    print(f"Opening new page for session {session_id} and navigating to {url}...")
    
    page = await _browser.new_page()
    
    # Memory-optimized page settings
    # Block heavy resources to reduce memory usage
    async def route_handler(route):
        resource_type = route.request.resource_type
        # Block heavy media and fonts (fonts can be large)
        if resource_type in ['media', 'font']:  # Block videos/audio and fonts
            await route.abort()
        else:
            await route.continue_()
    
    await page.route('**/*', route_handler)
    
    # Set viewport to reasonable size to reduce memory
    await page.set_viewport_size({"width": 1280, "height": 720})
    
    # Set timeout for Figma prototypes
    page.set_default_timeout(45000)  # 45 seconds (reduced for faster failure)
    
    # For Figma prototypes, use 'domcontentloaded' first (fastest)
    # Figma constantly loads resources, so 'networkidle' may never trigger
    try:
        # Start with 'domcontentloaded' - fastest, good enough for Figma
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        # Give a brief moment for initial rendering (Figma needs this)
        await asyncio.sleep(0.5)  # Reduced to 0.5 seconds
    except Exception as e:
        print(f"Navigation with domcontentloaded failed, trying 'load' instead: {e}")
        try:
            # Fallback to 'load' if domcontentloaded fails
            await page.goto(url, wait_until="load", timeout=45000)
        except Exception as e2:
            print(f"Navigation with 'load' also failed, trying 'networkidle' as last resort: {e2}")
            # Last resort: try networkidle (slowest, but most reliable)
            try:
                await page.goto(url, wait_until="networkidle", timeout=20000)  # Shorter timeout for networkidle
            except Exception as e3:
                print(f"All navigation strategies failed: {e3}")
                # If all fail, at least we tried - the page might still be usable
                raise
    
    _sessions[session_id] = page
    print(f"Session {session_id} started successfully.")
    return session_id

async def close_session(session_id: str):
    """
    Closes the specified browser session and cleans up resources.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if page:
        print(f"Closing session {session_id}...")
        try:
            # Close the page to free memory
            if not page.is_closed():
                await page.close()
            # Remove from sessions dict
            del _sessions[session_id]
            print(f"Session {session_id} closed and cleaned up.")
        except Exception as e:
            print(f"Error closing session {session_id}: {e}")
            # Still remove from dict even if close failed
            if session_id in _sessions:
                del _sessions[session_id]
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
    For Figma prototypes, detects blue highlighted clickable elements and clicks them accurately.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        return False

    print(f"Clicking at ({x}, {y}) for session {session_id}")
    try:
        # First, try to detect Figma's blue highlighted clickable elements
        # Figma shows clickable elements with a blue outline when you hover/click
        clickable_element_info = await page.evaluate("""
            ([x, y]) => {
                // Look for Figma's highlighted clickable elements (blue outline)
                // These are typically elements with specific Figma classes or data attributes
                const allElements = document.elementsFromPoint(x, y);
                
                // Check for Figma-specific clickable indicators
                for (const elem of allElements) {
                    const style = window.getComputedStyle(elem);
                    const rect = elem.getBoundingClientRect();
                    
                    // Check for blue outline (Figma's clickable indicator)
                    // Figma uses rgba(18, 96, 255, ...) or similar blue colors for highlights
                    const outlineColor = style.outlineColor || '';
                    const borderColor = style.borderColor || '';
                    const boxShadow = style.boxShadow || '';
                    
                    // Check if element has Figma's clickable indicator (blue highlight)
                    const hasBlueHighlight = 
                        outlineColor.includes('rgb(18, 96, 255)') ||
                        outlineColor.includes('rgb(18, 96, 255)') ||
                        borderColor.includes('rgb(18, 96, 255)') ||
                        boxShadow.includes('rgb(18, 96, 255)') ||
                        boxShadow.includes('rgba(18, 96, 255') ||
                        // Also check for cursor pointer (clickable indicator)
                        style.cursor === 'pointer' ||
                        elem.onclick !== null ||
                        elem.getAttribute('role') === 'button' ||
                        elem.tagName === 'BUTTON' ||
                        elem.tagName === 'A';
                    
                    if (hasBlueHighlight && rect.width > 0 && rect.height > 0) {
                        // Found a clickable element - return its center coordinates
                        return {
                            found: true,
                            centerX: rect.left + rect.width / 2,
                            centerY: rect.top + rect.height / 2,
                            boundingRect: {
                                x: rect.left,
                                y: rect.top,
                                width: rect.width,
                                height: rect.height
                            },
                            isClickable: true
                        };
                    }
                }
                
                // If no highlighted element, check iframe content (Figma prototypes are in iframes)
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const iframeRect = iframe.getBoundingClientRect();
                        if (x >= iframeRect.left && x <= iframeRect.right && 
                            y >= iframeRect.top && y <= iframeRect.bottom) {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (iframeDoc) {
                                const iframeX = x - iframeRect.left;
                                const iframeY = y - iframeRect.top;
                                const iframeElement = iframeDoc.elementFromPoint(iframeX, iframeY);
                                
                                if (iframeElement) {
                                    const iframeStyle = iframeDoc.defaultView?.getComputedStyle(iframeElement);
                                    const iframeRect2 = iframeElement.getBoundingClientRect();
                                    
                                    if (iframeStyle && (
                                        iframeStyle.cursor === 'pointer' ||
                                        iframeElement.onclick !== null ||
                                        iframeElement.getAttribute('role') === 'button'
                                    )) {
                                        // Calculate center relative to main page
                                        const centerX = iframeRect.left + iframeRect2.left + iframeRect2.width / 2;
                                        const centerY = iframeRect.top + iframeRect2.top + iframeRect2.height / 2;
                                        
                                        return {
                                            found: true,
                                            centerX: centerX,
                                            centerY: centerY,
                                            boundingRect: {
                                                x: iframeRect.left + iframeRect2.left,
                                                y: iframeRect.top + iframeRect2.top,
                                                width: iframeRect2.width,
                                                height: iframeRect2.height
                                            },
                                            isClickable: true,
                                            isIframe: true
                                        };
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe, can't access
                        continue;
                    }
                }
                
                // Fallback: find any element at point
                const element = document.elementFromPoint(x, y);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    return {
                        found: true,
                        centerX: rect.left + rect.width / 2,
                        centerY: rect.top + rect.height / 2,
                        boundingRect: {
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height
                        },
                        isClickable: false
                    };
                }
                
                return { found: false };
            }
        """, [x, y])
        
        actual_x = x
        actual_y = y
        
        # If we found a clickable element, use its center
        if clickable_element_info.get('found'):
            actual_x = int(clickable_element_info['centerX'])
            actual_y = int(clickable_element_info['centerY'])
            print(f"Found clickable element, clicking center at ({actual_x}, {actual_y}) instead of ({x}, {y})")
            
            # If it's in an iframe, we need to click within the iframe context
            if clickable_element_info.get('isIframe'):
                # Try to find and click within the iframe
                try:
                    iframe_handles = await page.query_selector_all('iframe')
                    for iframe_handle in iframe_handles:
                        try:
                            frame = await iframe_handle.content_frame()
                            if frame:
                                # Click at the relative coordinates within the iframe
                                iframe_rect = await iframe_handle.bounding_box()
                                if iframe_rect:
                                    iframe_x = actual_x - int(iframe_rect['x'])
                                    iframe_y = actual_y - int(iframe_rect['y'])
                                    await frame.mouse.click(iframe_x, iframe_y)
                                    print(f"Successfully clicked within iframe at ({iframe_x}, {iframe_y})")
                                    await _show_click_indicator(page, x, y, actual_x, actual_y)
                                    return True
                        except:
                            continue
                except Exception as iframe_err:
                    print(f"Could not click in iframe, falling back to coordinate: {iframe_err}")
        
        # Show visual indicator with smooth animation
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
    """Helper method to show visual click indicator with smooth animation and cursor trail"""
    await page.evaluate("""
        ([x, y, actualX, actualY]) => {
            // Remove any existing indicators first
            const existing = document.querySelectorAll('.kiwi-click-indicator');
            existing.forEach(el => el.remove());
            
            // Create smooth cursor trail animation showing movement
            const createCursorTrail = (startX, startY, endX, endY, color, size) => {
                const steps = 8;
                const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                
                // Only show trail if movement is significant
                if (distance < 10) return;
                
                for (let i = 0; i <= steps; i++) {
                    const progress = i / steps;
                    // Use easing for smoother trail
                    const easedProgress = 1 - Math.pow(1 - progress, 3);
                    const trailX = startX + (endX - startX) * easedProgress;
                    const trailY = startY + (endY - startY) * easedProgress;
                    const opacity = 0.15 + (0.65 * (1 - progress));
                    const scale = 0.3 + (0.7 * progress);
                    
                    const dot = document.createElement('div');
                    dot.className = 'kiwi-click-indicator kiwi-cursor-trail';
                    dot.style.position = 'fixed';
                    dot.style.left = trailX + 'px';
                    dot.style.top = trailY + 'px';
                    dot.style.width = (size * scale) + 'px';
                    dot.style.height = (size * scale) + 'px';
                    dot.style.backgroundColor = color;
                    dot.style.borderRadius = '50%';
                    dot.style.pointerEvents = 'none';
                    dot.style.zIndex = (999999 - i).toString();
                    dot.style.transform = 'translate(-50%, -50%)';
                    dot.style.opacity = opacity.toString();
                    
                    document.body.appendChild(dot);
                    
                    // Fade out trail dots smoothly
                    setTimeout(() => {
                        dot.style.transition = 'opacity 0.25s ease-out';
                        dot.style.opacity = '0';
                        setTimeout(() => dot.remove(), 250);
                    }, i * 30);
                }
            };
            
            // Create main click indicator at actual position (red, larger, more visible)
            const dot = document.createElement('div');
            dot.className = 'kiwi-click-indicator';
            dot.style.position = 'fixed';
            dot.style.left = actualX + 'px';
            dot.style.top = actualY + 'px';
            dot.style.width = '32px';
            dot.style.height = '32px';
            dot.style.backgroundColor = 'rgba(255, 0, 0, 0.96)';
            dot.style.borderRadius = '50%';
            dot.style.pointerEvents = 'none';
            dot.style.zIndex = '999999';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.boxShadow = '0 0 35px rgba(255, 0, 0, 1), 0 0 25px rgba(255, 0, 0, 0.9), 0 0 15px rgba(255, 0, 0, 0.7)';
            dot.style.border = '4px solid white';
            
            // Add smooth pulse animation styles
            if (!document.getElementById('kiwi-click-indicator-styles')) {
                const style = document.createElement('style');
                style.id = 'kiwi-click-indicator-styles';
                style.textContent = `
                    @keyframes kiwiClickPulse {
                        0% { 
                            transform: translate(-50%, -50%) scale(0.15); 
                            opacity: 0.2; 
                        }
                        12% { 
                            transform: translate(-50%, -50%) scale(1.6); 
                            opacity: 1; 
                        }
                        25% { 
                            transform: translate(-50%, -50%) scale(1.15); 
                            opacity: 0.98; 
                        }
                        100% { 
                            transform: translate(-50%, -50%) scale(1); 
                            opacity: 0.96; 
                        }
                    }
                    .kiwi-click-indicator {
                        animation: kiwiClickPulse 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(dot);
            
            // Create smooth cursor trail if position changed (shows movement path)
            if (Math.abs(actualX - x) > 5 || Math.abs(actualY - y) > 5) {
                createCursorTrail(x, y, actualX, actualY, 'rgba(255, 255, 0, 0.75)', 16);
                
                // Show original target position (yellow, smaller)
                const originalDot = document.createElement('div');
                originalDot.className = 'kiwi-click-indicator kiwi-original-target';
                originalDot.style.position = 'fixed';
                originalDot.style.left = x + 'px';
                originalDot.style.top = y + 'px';
                originalDot.style.width = '22px';
                originalDot.style.height = '22px';
                originalDot.style.backgroundColor = 'rgba(255, 255, 0, 0.92)';
                originalDot.style.borderRadius = '50%';
                originalDot.style.pointerEvents = 'none';
                originalDot.style.zIndex = '999998';
                originalDot.style.transform = 'translate(-50%, -50%)';
                originalDot.style.boxShadow = '0 0 30px rgba(255, 255, 0, 0.95)';
                originalDot.style.border = '3px solid white';
                originalDot.style.transition = 'opacity 0.5s ease-out';
                document.body.appendChild(originalDot);

                setTimeout(() => {
                    originalDot.style.opacity = '0';
                    setTimeout(() => originalDot.remove(), 500);
                }, 3200);
            }
            
            // Fade out main indicator after showing
            setTimeout(() => {
                dot.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
                dot.style.opacity = '0';
                dot.style.transform = 'translate(-50%, -50%) scale(1.7)';
                setTimeout(() => dot.remove(), 800);
            }, 4200);
        }
    """, [original_x, original_y, actual_x, actual_y])

async def take_screenshot(session_id: str) -> bytes:
    """
    Takes a screenshot of the current page and returns the bytes.
    For Figma prototypes, uses a longer timeout as they can be slow to render.
    """
    global _sessions
    page = _sessions.get(session_id)
    
    if not page or page.is_closed():
        print(f"Error: Session {session_id} not found or closed.")
        raise ValueError(f"Session {session_id} not found or closed")
    
    try:
        print(f"Taking screenshot for session {session_id}...")
        
        # Check if page is a Figma prototype (longer timeout needed)
        is_figma = 'figma.com' in page.url
        
        # Use longer timeout for Figma prototypes (20 seconds) vs regular pages (10 seconds)
        timeout = 20.0 if is_figma else 10.0
        
        # Try to take screenshot with timeout and reduced quality for memory efficiency
        try:
            screenshot_bytes = await asyncio.wait_for(
                page.screenshot(full_page=False, quality=60, type='jpeg'),  # JPEG with 60% quality for smaller size
                timeout=timeout
            )
            return screenshot_bytes
        except asyncio.TimeoutError:
            print(f"Warning: Screenshot timeout ({timeout}s) for session {session_id}, trying with lower quality...")
            
            # Retry with even lower quality if first attempt times out
            try:
                screenshot_bytes = await asyncio.wait_for(
                    page.screenshot(full_page=False, quality=40, type='jpeg'),  # Lower quality for speed and memory
                    timeout=timeout
                )
                print(f"Successfully took screenshot with reduced quality for session {session_id}")
                return screenshot_bytes
            except asyncio.TimeoutError:
                print(f"Error: Screenshot timeout even with reduced quality for session {session_id}")
                # Check if page is still responsive
                try:
                    await asyncio.wait_for(page.evaluate("() => document.readyState"), timeout=2.0)
                    print(f"Page is still responsive, but screenshot is timing out")
                except:
                    print(f"Page appears unresponsive")
                
                # Return a minimal error screenshot or raise
                raise ValueError(f"Screenshot timeout for session {session_id} after {timeout}s")
                
    except ValueError:
        # Re-raise ValueError (our custom errors)
        raise
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
