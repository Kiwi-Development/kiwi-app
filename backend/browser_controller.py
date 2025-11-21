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
