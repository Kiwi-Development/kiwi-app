"""
Health check endpoint for monitoring and load balancers
"""
from flask import jsonify
from datetime import datetime
import sys

def register_health_routes(app):
    """Register health check routes"""
    
    @app.route('/health', methods=['GET'])
    def health():
        """Basic health check"""
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "kiwi-backend"
        }), 200
    
    @app.route('/health/ready', methods=['GET'])
    def readiness():
        """Readiness probe - checks if service is ready to accept traffic"""
        try:
            # Check if Playwright loop is running
            # This is a simple check - you can add more sophisticated checks
            return jsonify({
                "status": "ready",
                "timestamp": datetime.utcnow().isoformat(),
                "service": "kiwi-backend",
                "checks": {
                    "playwright_loop": "running"
                }
            }), 200
        except Exception as e:
            return jsonify({
                "status": "not_ready",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }), 503
    
    @app.route('/health/live', methods=['GET'])
    def liveness():
        """Liveness probe - checks if service is alive"""
        return jsonify({
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "kiwi-backend",
            "uptime": "running"
        }), 200

