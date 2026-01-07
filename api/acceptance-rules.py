from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta
import httpx
import json
import os
import sys
import uuid
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


def fetch_rules(token, host):
    with httpx.Client() as client:
        response = client.get(
            f"{host}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels",
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


def fetch_rule_detail(token, host, regel_id):
    with httpx.Client() as client:
        response = client.get(
            f"{host}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels/{regel_id}",
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


def delete_rule(token, host, regel_id):
    with httpx.Client() as client:
        response = client.delete(
            f"{host}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels/{regel_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        if response.content:
            return response.json()
        return {"status": "deleted"}


def create_rule(token, host, payload):
    with httpx.Client() as client:
        response = client.put(
            f"{host}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels/invoeren",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        if response.content:
            return response.json()
        return {"status": "created"}


def update_rule(token, host, payload):
    with httpx.Client() as client:
        response = client.put(
            f"{host}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels/wijzigen",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Tenant-CustomerId": "30439",
                "BedrijfId": "1",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        if response.content:
            return response.json()
        return {"status": "updated"}


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

            # Prefer /api/acceptance-rules?regelId=<id>, but keep /api/acceptance-rules/<id> as fallback.
            regel_id = None
            regel_id = query_params.get("regelId", [None])[0]
            if not regel_id and len(parts) >= 3 and parts[0] == "api" and parts[1] == "acceptance-rules":
                regel_id = parts[2] if len(parts) >= 3 and parts[2] else None

            if regel_id:
                data = fetch_rule_detail(token, config["host"], regel_id)
            else:
                data = fetch_rules(token, config["host"])

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

    def do_DELETE(self):
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

            regel_id = query_params.get("regelId", [None])[0]
            if not regel_id and len(parts) >= 3 and parts[0] == "api" and parts[1] == "acceptance-rules":
                regel_id = parts[2] if len(parts) >= 3 and parts[2] else None

            if not regel_id:
                self._send_json({"error": "regelId is required"}, status_code=400)
                return

            data = delete_rule(token, config["host"], regel_id)
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

    def do_PUT(self):
        try:
            if not is_authorized(self.headers):
                send_unauthorized(self)
                return
            parsed = urlparse(self.path)
            query_params = parse_qs(parsed.query or "")
            env_param = query_params.get("env", ["production"])[0]
            env_key = "acceptance" if env_param == "acceptance" else "production"
            config = get_env_config(env_key)
            token = get_bearer_token(env_key)

            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length).decode() if content_length else ""
            body = json.loads(raw_body) if raw_body else {}

            afd_code = body.get("AfdBrancheCodeId")
            omschrijving = body.get("Omschrijving")
            expressie = body.get("Expressie")
            regel_id = body.get("RegelId")
            resource_id = body.get("ResourceId") or str(uuid.uuid4())

            if regel_id is not None:
                if expressie is None or omschrijving is None:
                    self._send_json({"error": "RegelId, Omschrijving, and Expressie are required"}, status_code=400)
                    return
                payload = {
                    "RegelId": regel_id,
                    "Omschrijving": omschrijving,
                    "Expressie": expressie,
                    "ResourceId": resource_id,
                }
                data = update_rule(token, config["host"], payload)
            else:
                if afd_code is None or omschrijving is None or expressie is None:
                    self._send_json({"error": "AfdBrancheCodeId, Omschrijving, and Expressie are required"}, status_code=400)
                    return
                payload = {
                    "AfdBrancheCodeId": afd_code,
                    "Omschrijving": omschrijving,
                    "Expressie": expressie,
                    "ResourceId": resource_id,
                }
                data = create_rule(token, config["host"], payload)
            self._send_json(data, status_code=200)
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
