from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta
import httpx
import json
import os
from urllib.parse import parse_qs, urlparse

# Cache bearer token between requests to reduce token calls
token_cache = {"token": None, "expires_at": None}

KINETIC_HOST = "https://kinetic.private-insurance.eu"
CLIENT_ID = os.getenv("KINETIC_CLIENT_ID")
CLIENT_SECRET = os.getenv("KINETIC_CLIENT_SECRET")


def get_bearer_token():
    # Reuse token if it is still valid
    if token_cache["token"] and token_cache["expires_at"]:
        if datetime.now() < token_cache["expires_at"]:
            return token_cache["token"]

    if not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("KINETIC_CLIENT_ID or KINETIC_CLIENT_SECRET is not set")

    with httpx.Client() as client:
        response = client.post(
            f"{KINETIC_HOST}/token",
            params={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
            timeout=30.0,
        )
        response.raise_for_status()

        data = response.json()
        token = data.get("access_token")
        expires_in = data.get("expires_in", 3600)

        if not token:
            raise RuntimeError("Bearer token missing from token response")

        # Refresh 5 minutes before expiry
        token_cache["token"] = token
        token_cache["expires_at"] = datetime.now() + timedelta(
            seconds=max(expires_in - 300, 60)
        )
        return token


def fetch_rules(token):
    with httpx.Client() as client:
        response = client.get(
            f"{KINETIC_HOST}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                # Required tenant/company headers for DIAS API
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            rules = data
        elif isinstance(data, dict) and "data" in data:
            rules = data["data"]
        elif isinstance(data, dict) and "rules" in data:
            rules = data["rules"]
        else:
            rules = [data] if data else []

        return {"rules": rules, "count": len(rules)}


def fetch_rule_detail(token, regel_id):
    with httpx.Client() as client:
        response = client.get(
            f"{KINETIC_HOST}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels/{regel_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()


class handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status_code=200):
        body = json.dumps(payload).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            token = get_bearer_token()
            parsed = urlparse(self.path)
            parts = [p for p in parsed.path.split("/") if p]

            # Prefer /api/acceptance-rules?regelId=<id>, but keep /api/acceptance-rules/<id> as fallback.
            regel_id = None
            query_params = parse_qs(parsed.query or "")
            regel_id = query_params.get("regelId", [None])[0]
            if not regel_id and len(parts) >= 3 and parts[0] == "api" and parts[1] == "acceptance-rules":
                regel_id = parts[2] if len(parts) >= 3 and parts[2] else None

            if regel_id:
                data = fetch_rule_detail(token, regel_id)
            else:
                data = fetch_rules(token)

            self._send_json(data, status_code=200)
        except httpx.HTTPStatusError as exc:
            detail = {
                "error": "Upstream request failed",
                "status_code": exc.response.status_code,
                "message": exc.response.text,
            }
            self._send_json(detail, status_code=exc.response.status_code)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status_code=500)
