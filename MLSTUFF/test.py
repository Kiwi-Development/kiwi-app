import os, time, json, random, base64, re
from playwright.sync_api import sync_playwright
from openai import OpenAI

client = OpenAI(api_key="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")

def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = "\n".join(text.splitlines()[1:-1]).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    return m.group(0) if m else text

def think_with_vision_viewport(url, image_b64, viewport_size):
    vw, vh = viewport_size["width"], viewport_size["height"]
    prompt = f"""
    
    You are an AI usability tester navigating a Figma prototype or website.

    Current URL: {url}
    You are seeing the FULL browser viewport image. Size: {vw}x{vh} pixels.

    Return ONLY one JSON object:

    {{
    "thought": "brief reasoning",
    "action": "click",
    "coords_norm": [x_norm, y_norm]  // floats in [0,1] relative to the FULL viewport
    }}
    or
    {{
    "thought": "brief reasoning",
    "action": "stop"
    }}

    Important rules:
    - Choose a point INSIDE the phone/prototype screen visible in the image (avoid surrounding chrome, sidebars, black margins).
    - coords_norm MUST be within [0,1] for both x and y.
    The login will be at (650, 570)
    """

    resp = client.chat.completions.create(
        model="gpt-4o",
        temperature=0.2,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
            ],
        }],
    )
    raw = resp.choices[0].message.content
    try:
        obj = json.loads(_extract_json(raw))
    except Exception:
        return {"thought": f"Could not parse: {raw}", "action": "stop"}

    if obj.get("action") == "click":
        try:
            xn, yn = obj.get("coords_norm", [None, None])
            xn = max(0.0, min(1.0, float(xn)))
            yn = max(0.0, min(1.0, float(yn)))
            obj["coords_norm"] = [xn, yn]
        except Exception:
            obj["action"] = "stop"
    return obj

def run_visual_usability_test(url, max_steps=1):
    logs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Don't wait for "networkidle" (Figma uses websockets); DOM ready is enough.
        page.goto(url, wait_until="domcontentloaded")
        time.sleep(2.5)

        viewport = page.viewport_size

        for step in range(max_steps):
            screenshot_path = f"step_{step+1}.png"
            # Full viewport screenshot
            page.screenshot(path=screenshot_path, full_page=False)

            with open(screenshot_path, "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode("utf-8")

            decision = think_with_vision_viewport(page.url, image_b64, viewport)

            logs.append({
                "timestamp": time.time(),
                "url": page.url,
                "thought": decision.get("thought"),
                "action": decision.get("action"),
                "coords_norm": decision.get("coords_norm"),
                "screenshot": screenshot_path,
                "viewport": viewport,
            })

            print(f"\n🤔 Step {step+1}: {decision.get('thought')}")
            if decision.get("action") != "click" or not decision.get("coords_norm"):
                print("🛑 Stopping test.")
                break

            # Map normalized viewport coords -> absolute page coords
            xn, yn = decision["coords_norm"]
            abs_x = xn * viewport["width"]
            abs_y = yn * viewport["height"]

            try:
                # Visual aid dot
                page.evaluate(f"""
                    const dot = document.createElement('div');
                    dot.style.position = 'fixed';
                    dot.style.left = '{abs_x}px';
                    dot.style.top = '{abs_y}px';
                    dot.style.width = '18px';
                    dot.style.height = '18px';
                    dot.style.borderRadius = '50%';
                    dot.style.background = 'red';
                    dot.style.opacity = '0.7';
                    dot.style.zIndex = 999999;
                    document.body.appendChild(dot);
                    setTimeout(() => dot.remove(), 1200);
                """)
                time.sleep(0.1)
                page.mouse.click(abs_x, abs_y)
                print(f"🖱️ Clicked at viewport coords ({abs_x:.1f}, {abs_y:.1f}) from norm ({xn:.3f}, {yn:.3f})")
            except Exception as e:
                print(f"⚠️ Could not click: {e}")
                break

            time.sleep(random.uniform(1.2, 2.0))

        browser.close()

    with open("vision_usability_session.json", "w") as f:
        json.dump(logs, f, indent=2)
    print("\n✅ Test complete. Logs saved to vision_usability_session.json")


if __name__ == "__main__":
    run_visual_usability_test(
        "https://www.figma.com/proto/tNdfkwK0J56qDTSgmGQZFn/sample-prototype--Community-?node-id=105-6&p=f&t=nGhCp0qzbpcl0BT5-0&scaling=scale-down&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=105%3A6&show-proto-sidebar=1",
        max_steps=3
    )
