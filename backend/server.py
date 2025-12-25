import os
import base64
import asyncio
import threading
import time
import subprocess
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import browser_controller
import sys
import traceback
import logging
from health import register_health_routes

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
# Enable CORS for all routes with more permissive settings
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Register health check routes
register_health_routes(app)

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

@app.route('/start', methods=['POST'])
def start_session():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "Invalid input, 'url' is required"}), 400
    
    url = data['url']
    
    try:
        print(f"Starting new session with URL: {url}")
        session_id = run_async(browser_controller.start_session(url))
        schedule_session_timeout(session_id)
        return jsonify({"status": "ok", "message": "Session started", "sessionId": session_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/click', methods=['POST'])
def click():
    data = request.get_json()
    if not data or 'x' not in data or 'y' not in data or 'sessionId' not in data:
        return jsonify({"error": "Invalid input, 'x', 'y', and 'sessionId' are required"}), 400
    
    x = data['x']
    y = data['y']
    session_id = data['sessionId']
    
    try:
        old_url = run_async(browser_controller.get_current_url(session_id))
        run_async(browser_controller.click_at(session_id, x, y))
        new_url = run_async(browser_controller.get_current_url(session_id))

        if old_url == new_url:
            return jsonify({"status": "click_failed", "message" : "Click failed to hit button. Try again."})
        
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/screenshot', methods=['POST'])
def screenshot():
    data = request.get_json()
    if not data or 'sessionId' not in data:
        return jsonify({"error": "Invalid input, 'sessionId' is required"}), 400
        
    session_id = data['sessionId']

    try:
        img_bytes = run_async(browser_controller.take_screenshot(session_id))
        
        if not img_bytes:
             return jsonify({"status": "error", "message": "Failed to capture screenshot"}), 500
            
        # Encode to base64
        b64_string = base64.b64encode(img_bytes).decode('utf-8')
        
        return jsonify({
            "status": "ok",
            "screenshot": b64_string
        })
    except Exception as e:
        error_details = traceback.format_exc()
        # This WILL show up in logs because it's an exception
        print(f"ERROR: {error_details}", file=sys.stderr, flush=True)
        return jsonify({"status": "error", "message": str(e), "details": error_details}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)