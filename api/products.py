from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta
import httpx
import json
import os
import sys
from urllib.parse import parse_qs, urlparse

current_dir = os.path.dirname(__file__)
if current_dir not in sys.path:
    sys.path.append(current_dir)

from _auth import is_authorized, send_unauthorized

# Cache bearer token between requests to reduce token calls
token_cache = {
    "production": {"token": None, "expires_at": None},
    "acceptance": {"token": None, "expires_at": None},
}

DEFAULT_KINETIC_HOST = os.getenv("KINETIC_HOST", "https://kinetic.private-insurance.eu")
DEFAULT_CLIENT_ID = os.getenv("KINETIC_CLIENT_ID")
DEFAULT_CLIENT_SECRET = os.getenv("KINETIC_CLIENT_SECRET")
ACCEPTANCE_KINETIC_HOST = os.getenv("KINETIC_HOST_ACCEPTANCE", DEFAULT_KINETIC_HOST)
ACCEPTANCE_CLIENT_ID = os.getenv("KINETIC_CLIENT_ID_ACCEPTANCE", DEFAULT_CLIENT_ID)
ACCEPTANCE_CLIENT_SECRET = os.getenv("KINETIC_CLIENT_SECRET_ACCEPTANCE", DEFAULT_CLIENT_SECRET)


def get_env_config(env_key):
    if env_key == "acceptance":
        return {
            "host": ACCEPTANCE_KINETIC_HOST,
            "client_id": ACCEPTANCE_CLIENT_ID,
            "client_secret": ACCEPTANCE_CLIENT_SECRET,
        }
    return {
        "host": DEFAULT_KINETIC_HOST,
        "client_id": DEFAULT_CLIENT_ID,
        "client_secret": DEFAULT_CLIENT_SECRET,
    }


def get_bearer_token(env_key="production"):
    # Reuse token if it is still valid
    cache = token_cache.get(env_key, token_cache["production"])
    if cache["token"] and cache["expires_at"]:
        if datetime.now() < cache["expires_at"]:
            return cache["token"]

    config = get_env_config(env_key)
    if not config["client_id"] or not config["client_secret"]:
        raise RuntimeError(
            f"KINETIC_CLIENT_ID or KINETIC_CLIENT_SECRET is not set for {env_key}"
        )

    with httpx.Client() as client:
        response = client.post(
            f"{config['host']}/token",
            params={
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
            },
            timeout=30.0,
        )
        response.raise_for_status()

        data = response.json()
        token = data.get("access_token")
        expires_in = data.get("expires_in", 3600)

        if not token:
            raise RuntimeError("Bearer token missing from token response")

        # Refresh 5 minutes before expiry
        cache["token"] = token
        cache["expires_at"] = datetime.now() + timedelta(
            seconds=max(expires_in - 300, 60)
        )
        return token


def fetch_products(token, host):
    with httpx.Client() as client:
        response = client.get(
            f"{host}/contract/api/v1/contracten/verzekeringen/productdefinities",
            params={
                "AlleenLopendProduct": "<false>",
                "IsBeschikbaarVoorAgent": "<true>",
                "IsBeschikbaarVoorKlant": "<true>",
                "IsBeschikbaarVoorMedewerker": "<true>",
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
                "MedewerkerId": "1",
                "KantoorId": "1",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        return [data] if data else []


def fetch_product_detail(token, host, product_id):
    with httpx.Client() as client:
        response = client.get(
            f"{host}/contract/api/v1/contracten/verzekeringen/productdefinities/{product_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
                "MedewerkerId": "1",
                "KantoorId": "1",
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
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            if not is_authorized(self.headers):
                send_unauthorized(self)
                return
            parsed = urlparse(self.path)
            parts = [p for p in parsed.path.split("/") if p]
            query_params = parse_qs(parsed.query or "")
            env_param = query_params.get("env", ["production"])[0]
            env_key = "acceptance" if env_param == "acceptance" else "production"
            config = get_env_config(env_key)
            token = get_bearer_token(env_key)

            # Prefer /api/products?productId=<id>, but keep /api/products/<id> as fallback.
            product_id = None
            product_id = query_params.get("productId", [None])[0]
            if not product_id and len(parts) >= 3 and parts[0] == "api" and parts[1] == "products":
                product_id = parts[2] if len(parts) >= 3 and parts[2] else None

            if product_id:
                data = fetch_product_detail(token, config["host"], product_id)
                self._send_json(data, status_code=200)
            else:
                data = fetch_products(token, config["host"])
                self._send_json({"products": data, "count": len(data)}, status_code=200)
        except httpx.HTTPStatusError as exc:
            detail = {
                "error": "Upstream request failed",
                "status_code": exc.response.status_code,
                "message": exc.response.text,
            }
            self._send_json(detail, status_code=exc.response.status_code)
        except Exception as exc:
            self._send_json({"error": str(exc)}, status_code=500)
