from http.server import BaseHTTPRequestHandler
import base64
import httpx
import json
import os


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2")
OPENAI_MAX_OUTPUT_TOKENS = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "350"))


def build_prompt(expression):
    return (
        "You are a Xpath expression interpreter. Explain step by step in clear Dutch "
        "what this Xpath expression does functionally:\n"
        f"{expression}"
    )


class handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status_code=200):
        body = json.dumps(payload).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_unauthorized(self):
        body = json.dumps({"error": "Unauthorized"}).encode()
        self.send_response(401)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("WWW-Authenticate", 'Basic realm="Acceptatiebeheer"')
        self.end_headers()
        self.wfile.write(body)

    def _is_authorized(self):
        user = os.getenv("BASIC_AUTH_USER")
        password = os.getenv("BASIC_AUTH_PASS")
        if not user or not password:
            return True
        auth_header = self.headers.get("Authorization") or ""
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

    def do_POST(self):
        try:
            if not self._is_authorized():
                self._send_unauthorized()
                return
            if not OPENAI_API_KEY:
                self._send_json({"error": "OPENAI_API_KEY is not set"}, status_code=500)
                return

            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode() if content_length else ""
            body = json.loads(raw_body) if raw_body else {}
            expression = body.get("expression")

            if not expression:
                self._send_json({"error": "expression is required"}, status_code=400)
                return

            prompt = build_prompt(expression)
            payload = {
                "model": OPENAI_MODEL,
                "input": prompt,
                "max_output_tokens": OPENAI_MAX_OUTPUT_TOKENS,
            }
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            }
            with httpx.Client() as client:
                response = client.post(
                    f"{OPENAI_BASE_URL}/responses",
                    headers=headers,
                    json=payload,
                    timeout=8.0,
                )
                response.raise_for_status()
                data = response.json()
                text = None
                for item in data.get("output", []):
                    if item.get("type") == "message":
                        for part in item.get("content", []):
                            if part.get("type") == "output_text":
                                text = part.get("text")
                                break
                    if text:
                        break
                if not text:
                    text = data.get("output_text")
                self._send_json({"explanation": text or ""}, status_code=200)
        except httpx.HTTPStatusError as exc:
            detail = {
                "error": "Upstream request failed",
                "status_code": exc.response.status_code,
                "message": exc.response.text,
            }
            self._send_json(detail, status_code=exc.response.status_code)
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body"}, status_code=400)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status_code=500)
