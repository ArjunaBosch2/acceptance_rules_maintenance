from http.server import BaseHTTPRequestHandler
import httpx
import json
import os
import sys

current_dir = os.path.dirname(__file__)
if current_dir not in sys.path:
    sys.path.append(current_dir)

from _auth import is_authorized, send_unauthorized


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2")
OPENAI_MAX_OUTPUT_TOKENS = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "350"))


def build_prompt(expression):
    return (
        "You are a Xpath expression interpreter. Answer in Dutch.\n"
        "Return exactly:\n"
        "- 3 to 5 bullet points, each a short sentence starting with '- '.\n"
        "Then one short summary sentence starting with 'Samenvatting:'.\n"
        "Do not add extra text.\n"
        "Xpath expression:\n"
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

    def do_POST(self):
        try:
            if not is_authorized(self.headers):
                send_unauthorized(self)
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
