import asyncio
from playwright.async_api import async_playwright

_playwright = None
_browser = None
_page = None

async def init_browser(figma_url: str):
    """
    Initializes the browser, opens a new page, and navigates to the given URL.
    """
    global _playwright, _browser, _page
    print(f"Initializing browser and navigating to {figma_url}...")
    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(headless=True)
    _page = await _browser.new_page()
    await _page.goto(figma_url)
    print("Browser initialized.")

async def get_current_url() -> str:
    """
    Returns the current URL of the page.
    """
    global _page
    if _page:
        return _page.url
    return ""

async def click_at(x: int, y: int) -> bool:
    """
    Clicks at the specified coordinates (x, y) and returns True if the page URL changed, False otherwise.
    """
    global _page
    if not _page:
        print("Error: Browser page not initialized.")
        return False

    print(f"Clicking at ({x}, {y})")
    try:
        # Inject visual indicator
        await _page.evaluate("""
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
            _page.mouse.click(x, y),
        )
    except Exception as e:
        print(f"An error occurred during click or navigation: {e}")
        return False

async def take_screenshot() -> bytes:
    """
    Takes a screenshot of the current page and returns the bytes.
    """
    global _page
    if _page:
        print("Taking screenshot...")
        return await _page.screenshot()
    else:
        print("Error: Browser page not initialized.")
        return b""
