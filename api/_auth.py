import base64
import json
import os


def is_authorized(headers):
    user = os.getenv("BASIC_AUTH_USER")
    password = os.getenv("BASIC_AUTH_PASS")
    if not user or not password:
        return True
    auth_header = headers.get("Authorization") or ""
    if not auth_header.startswith("Basic "):
        return False
    try:
        encoded = auth_header.split(" ", 1)[1]
        decoded = base64.b64decode(encoded).decode("utf-8")
    except Exception:
        return False
    if ":" not in decoded:
        return False
    input_user, input_pass = decoded.split(":", 1)
    return input_user == user and input_pass == password


def send_unauthorized(handler):
    body = json.dumps({"error": "Unauthorized"}).encode()
    handler.send_response(401)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("WWW-Authenticate", 'Basic realm="Acceptatiebeheer"')
    handler.end_headers()
    handler.wfile.write(body)
