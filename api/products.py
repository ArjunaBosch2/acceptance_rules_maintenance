from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta
import httpx
import json
import os

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


def fetch_products(token):
  with httpx.Client() as client:
    response = client.get(
      f"{KINETIC_HOST}/contract/api/v1/contracten/verzekeringen/productdefinities",
      params={
        "AlleenLopendProduct": "false",
        "IsBeschikbaarVoorAgent": "true",
        "IsBeschikbaarVoorKlant": "true",
        "IsBeschikbaarVoorMedewerker": "true",
      },
      headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Tenant-CustomerId": "30439",
        "BedrijfId": "1",
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
      data = fetch_products(token)
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
