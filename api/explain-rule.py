from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import httpx
import json
import os
import re
import sys

current_dir = os.path.dirname(__file__)
if current_dir not in sys.path:
    sys.path.append(current_dir)

from _auth import is_authorized, send_unauthorized
from products import fetch_product_detail, get_bearer_token, get_env_config


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2")
OPENAI_MAX_OUTPUT_TOKENS = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "350"))

RUBRIEK_PATTERN = re.compile(r"[A-Za-z]{1,10}_[A-Za-z0-9]+")


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


def extract_rubriek_codes(expression):
    seen = set()
    ordered = []
    for match in RUBRIEK_PATTERN.finditer(expression or ""):
        code = match.group(0)
        if code in seen:
            continue
        seen.add(code)
        ordered.append(code)
    return ordered


def get_ci_value(node, key):
    if not isinstance(node, dict):
        return None
    target = key.lower()
    for k, v in node.items():
        if str(k).lower() == target:
            return v
    return None


def has_ci_key(node, key):
    if not isinstance(node, dict):
        return False
    target = key.lower()
    return any(str(k).lower() == target for k in node.keys())


def collect_label_records(payload):
    records = []

    def walk(node):
        if isinstance(node, dict):
            if get_ci_value(node, "Labelnaam") and (
                has_ci_key(node, "RubriekId") or has_ci_key(node, "AFDlabel")
            ):
                records.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return records


def build_label_lookups(payload):
    custom_by_id = {}
    default_by_afdlabel = {}
    for record in collect_label_records(payload):
        label = get_ci_value(record, "Labelnaam")
        if not label:
            continue
        rubriek_id = get_ci_value(record, "RubriekId")
        if rubriek_id is not None:
            rubriek_id_str = str(rubriek_id)
            custom_by_id[rubriek_id_str] = label
            match = re.search(r"_(\d+)$", rubriek_id_str)
            if match:
                custom_by_id.setdefault(match.group(1), label)
        afd_label = get_ci_value(record, "AFDlabel")
        if afd_label:
            afd_label_str = str(afd_label)
            default_by_afdlabel[afd_label_str] = label
            if "_" in afd_label_str:
                default_by_afdlabel.setdefault(afd_label_str.split("_", 1)[1], label)
    return custom_by_id, default_by_afdlabel


def resolve_rubriek_labels(expression, product_payload):
    if not product_payload:
        return []
    custom_by_id, default_by_afdlabel = build_label_lookups(product_payload)
    labels = []
    for code in extract_rubriek_codes(expression):
        parts = code.split("_", 1)
        if len(parts) != 2:
            continue
        suffix = parts[1]
        label = custom_by_id.get(suffix) if suffix.isdigit() else default_by_afdlabel.get(suffix)
        if label:
            labels.append({"code": code, "label": label})
    return labels


def apply_label_overrides(text, rubriek_labels):
    if not text or not rubriek_labels:
        return text
    items = sorted(
        (
            (item.get("code"), item.get("label"))
            for item in rubriek_labels
            if item.get("code") and item.get("label")
        ),
        key=lambda pair: len(pair[0]),
        reverse=True,
    )
    updated = text
    for code, label in items:
        updated = re.sub(rf"\b{re.escape(code)}\b", str(label), updated)
    return updated


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
            product_id = body.get("productId") or body.get("product_id")
            labels_only = bool(body.get("labelsOnly"))

            if not expression:
                self._send_json({"error": "expression is required"}, status_code=400)
                return

            rubriek_labels = []
            if product_id:
                try:
                    parsed = urlparse(self.path)
                    query_params = parse_qs(parsed.query or "")
                    env_param = query_params.get("env", ["production"])[0]
                    env_key = "acceptance" if env_param == "acceptance" else "production"
                    config = get_env_config(env_key)
                    token = get_bearer_token(env_key)
                    product_payload = fetch_product_detail(token, config["host"], product_id)
                    rubriek_labels = resolve_rubriek_labels(expression, product_payload)
                except Exception:
                    rubriek_labels = []

            if labels_only:
                self._send_json(
                    {"explanation": "", "rubriekLabels": rubriek_labels},
                    status_code=200,
                )
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
                final_text = apply_label_overrides(text or "", rubriek_labels)
                self._send_json(
                    {"explanation": final_text or "", "rubriekLabels": rubriek_labels},
                    status_code=200,
                )
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
