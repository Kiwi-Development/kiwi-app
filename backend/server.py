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

app = Flask(__name__)
# Enable CORS for all routes
CORS(app)

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

def get_ecs_metadata():
    """Query ECS container metadata to get cluster and task ARN."""
    try:
        # Try Fargate metadata endpoint first
        metadata_uri = os.environ.get('ECS_CONTAINER_METADATA_URI_V4')
        
        if not metadata_uri:
            # Fall back to EC2 metadata endpoint
            metadata_uri = os.environ.get('ECS_CONTAINER_METADATA_URI')
        
        if not metadata_uri:
            print("Warning: ECS metadata URI not found. Task auto-termination disabled.")
            return None, None
        
        # Query task metadata
        import urllib.request
        task_metadata_url = f"{metadata_uri}/task"
        
        with urllib.request.urlopen(task_metadata_url) as response:
            task_data = json.loads(response.read().decode())
            
        cluster_arn = task_data.get('Cluster')
        task_arn = task_data.get('TaskARN')
        
        print(f"ECS Metadata - Cluster: {cluster_arn}, Task: {task_arn}")
        return cluster_arn, task_arn
        
    except Exception as e:
        print(f"Failed to query ECS metadata: {e}")
        return None, None

def stop_ecs_task(cluster_arn, task_arn):
    """Stop the ECS task using boto3."""
    try:
        import boto3
        
        print(f"Stopping ECS task after 5 minutes timeout...")
        
        ecs_client = boto3.client('ecs')
        
        response = ecs_client.stop_task(
            cluster=cluster_arn,
            task=task_arn,
            reason='Automatic shutdown after 5 minute timeout'
        )
        
        print(f"Successfully stopped ECS task: {response['task']['taskArn']}")
            
    except Exception as e:
        print(f"Error stopping ECS task: {e}")

def schedule_task_termination():
    """Schedule the ECS task to stop after 5 minutes."""
    cluster_arn, task_arn = get_ecs_metadata()
    
    if cluster_arn and task_arn:
        def timeout_handler():
            time.sleep(300)  # 5 minutes = 300 seconds
            stop_ecs_task(cluster_arn, task_arn)
        
        timeout_thread = threading.Thread(target=timeout_handler, daemon=True)
        timeout_thread.start()
        print("Scheduled ECS task termination in 5 minutes")
    else:
        print("Skipping task termination scheduling (not running in ECS or metadata unavailable)")

if len(sys.argv) < 2:
    print("Usage: python server.py <url>")
    sys.exit(1)

target_url = sys.argv[1]

try:
    print(f"Initializing browser with URL: {target_url}")
    run_async(browser_controller.init_browser(target_url))
except Exception as e:
    print(f"Failed to initialize browser: {e}")

# Schedule task termination after 5 minutes
schedule_task_termination()

@app.route('/click', methods=['POST'])
def click():
    data = request.get_json()
    if not data or 'x' not in data or 'y' not in data:
        return jsonify({"error": "Invalid input, 'x' and 'y' are required"}), 400
    
    x = data['x']
    y = data['y']
    
    try:
        old_url = run_async(browser_controller.get_current_url())
        run_async(browser_controller.click_at(x, y))
        new_url = run_async(browser_controller.get_current_url())

        if old_url == new_url:
            return jsonify({"status": "failed", "message": "Click did not result in a URL change, indicating a potential navigation failure."}), 400
        
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/screenshot', methods=['POST'])
def screenshot():
    try:
        # Create screenshots directory if it doesn't exist
        screenshots_dir = os.path.join(os.getcwd(), 'screenshots')
        os.makedirs(screenshots_dir, exist_ok=True)
        
        # Take screenshot
        img_bytes = run_async(browser_controller.take_screenshot())
        
        if not img_bytes:
             return jsonify({"status": "error", "message": "Failed to capture screenshot"}), 500

        # Save screenshot
        # Using a timestamp or simple counter could be better, but for now just 'latest.png' or similar?
        # The prompt says "Saves the screenshot inside a 'screenshots' directory". 
        # It doesn't specify filename. I'll use a timestamp.
        filename = f"screenshot_{int(time.time())}.png"
        filepath = os.path.join(screenshots_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(img_bytes)
            
        # Encode to base64
        b64_string = base64.b64encode(img_bytes).decode('utf-8')
        
        return jsonify({
            "status": "ok",
            "screenshot": b64_string
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)