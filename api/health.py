from http.server import BaseHTTPRequestHandler
from datetime import datetime
import json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        response = {"status": "healthy", "timestamp": datetime.now().isoformat()}
        self.wfile.write(json.dumps(response).encode())
