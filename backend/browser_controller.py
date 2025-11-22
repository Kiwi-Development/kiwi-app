import asyncio
from playwright.async_api import async_playwright

import uuid

_playwright = None
_browser = None
_sessions = {}

async def start_session(url: str) -> str:
    """
    Starts a new browser session.
    Ensures the browser is launched, opens a new page, and returns a session ID.
    """
    global _playwright, _browser, _sessions
    
    if not _playwright:
        print("Starting Playwright...")
        _playwright = await async_playwright().start()
        
    if not _browser:
        print("Launching Browser...")
        _browser = await _playwright.chromium.launch(
            headless=True,
            args=[
            '--disable-dev-shm-usage',  # Important for Docker
            '--no-sandbox',              # Often needed in containers
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--disable-blink-features=AutomationControlled'
        ]
        )
        
    session_id = str(uuid.uuid4())
    print(f"Opening new page for session {session_id} and navigating to {url}...")
    
    page = await _browser.new_page()
    await page.goto(url)
    
    _sessions[session_id] = page
    print(f"Session {session_id} started.")
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
                }, 10000);
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
