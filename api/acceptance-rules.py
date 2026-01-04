from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from datetime import datetime, timedelta

# Token cache
token_cache = {"token": None, "expires_at": None}

KINETIC_HOST = "https://kinetic.private-insurance.eu"
CLIENT_ID = os.getenv("KINETIC_CLIENT_ID")
CLIENT_SECRET = os.getenv("KINETIC_CLIENT_SECRET")


async def get_bearer_token():
    if token_cache["token"] and token_cache["expires_at"]:
        if datetime.now() < token_cache["expires_at"]:
            return token_cache["token"]

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{KINETIC_HOST}/token",
                params={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET},
                timeout=30.0,
            )
            response.raise_for_status()

            data = response.json()
            token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)

            token_cache["token"] = token
            token_cache["expires_at"] = datetime.now() + timedelta(
                seconds=expires_in - 300
            )

            return token

        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to obtain bearer token: {str(e)}"
            )


async def handler(request):
    try:
        token = await get_bearer_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{KINETIC_HOST}/beheer/api/v1/administratie/assurantie/regels/acceptatieregels",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
                timeout=30.0,
            )
            response.raise_for_status()

            data = response.json()

            rules = []
            if isinstance(data, list):
                rules = data
            elif isinstance(data, dict) and "data" in data:
                rules = data["data"]
            elif isinstance(data, dict) and "rules" in data:
                rules = data["rules"]
            else:
                rules = [data] if data else []

            return {"rules": rules, "count": len(rules)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
