import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SendPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    message_id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TelcoX External — Notification Gateway Mock",
    description=(
        "Simula un proveedor externo de notificaciones multicanal al estilo Twilio / "
        "SendGrid / Firebase Cloud Messaging. Acepta envíos de SMS, email y push, "
        "devuelve un `message_id` con estado de entrega y métricas simuladas."
    ),
    version="1.0.0",
    docs_url="/notification-gateway/docs",
    openapi_url="/notification-gateway/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

messages: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_latency(channel: str) -> None:
    """Simulate realistic latency per channel type."""
    delays = {"sms": (0.05, 0.25), "email": (0.10, 0.40), "push": (0.02, 0.15)}
    lo, hi = delays.get(channel, (0.05, 0.30))
    time.sleep(random.uniform(lo, hi))


def provider_for_channel(channel: str) -> str:
    return {
        "sms": "Twilio SMS API",
        "email": "SendGrid v3 API",
        "push": "Firebase Cloud Messaging",
    }.get(channel, "UnknownGateway")


def build_message(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "message_id": data.get("message_id", f"msg-{str(uuid4())[:12]}"),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8014")
    logging.info("External Notification Gateway Mock starting on port %s", port)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/notification-gateway/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "External Notification Gateway Mock"}


@app.post(
    "/notification-gateway/send",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    tags=["messages"],
)
def send_message(payload: SendPayload) -> dict[str, Any]:
    """
    Envía una notificación a través del canal especificado.

    Campos esperados en `data`:
    - `channel` ("sms" | "email" | "push", requerido)
    - `recipient` (str, requerido) — teléfono, email o device_token
    - `message` (str, requerido) — contenido de la notificación
    - `event_type` (str, opcional) — ej. "payment_approved", "plan_activated"
    - `customer_id` (str, opcional)
    - `template_id` (str, opcional) — ID de plantilla del proveedor
    - `mode` ("success" | "fail", default "success") — forzar resultado
    """
    data = payload.data
    channel = str(data.get("channel", "")).lower()
    recipient = data.get("recipient")
    message = data.get("message")

    if channel not in {"sms", "email", "push"}:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel '{channel}'. Must be one of: sms, email, push",
        )
    if not recipient:
        raise HTTPException(status_code=400, detail="Missing required field: recipient")
    if not message:
        raise HTTPException(status_code=400, detail="Missing required field: message")

    simulate_latency(channel)

    mode = data.get("mode", "success")
    if mode == "fail":
        raise HTTPException(
            status_code=503,
            detail={
                "error": "gateway_delivery_failed",
                "channel": channel,
                "reason": "Recipient unreachable or invalid",
                "provider": provider_for_channel(channel),
            },
        )

    provider = provider_for_channel(channel)
    delivery_status_map = {
        "sms": "delivered",
        "email": "delivered",
        "push": "sent",
    }

    msg = build_message({
        "channel": channel,
        "recipient": recipient,
        "message": message,
        "event_type": data.get("event_type"),
        "customer_id": data.get("customer_id"),
        "template_id": data.get("template_id"),
        "status": delivery_status_map[channel],
        "provider": provider,
        "provider_message_id": f"{channel.upper()}-{str(uuid4())[:10].upper()}",
        "segments": max(1, len(message) // 160) if channel == "sms" else 1,
        "delivered_at": utc_now(),
        "attempts": 1,
    })
    messages[msg["message_id"]] = msg
    return msg


@app.get(
    "/notification-gateway/delivery/{message_id}",
    response_model=MessageResponse,
    tags=["messages"],
)
def get_delivery_status(message_id: str) -> dict[str, Any]:
    """Consulta el estado de entrega de un mensaje por su ID."""
    msg = messages.get(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@app.get("/notification-gateway/messages", tags=["messages"])
def list_messages() -> list[dict[str, Any]]:
    """Lista todos los mensajes enviados en esta sesión."""
    return list(messages.values())


@app.get("/notification-gateway/stats", tags=["stats"])
def gateway_stats() -> dict[str, Any]:
    """Estadísticas de envío de esta sesión."""
    total = len(messages)
    by_channel: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for msg in messages.values():
        ch = msg.get("channel", "unknown")
        st = msg.get("status", "unknown")
        by_channel[ch] = by_channel.get(ch, 0) + 1
        by_status[st] = by_status.get(st, 0) + 1
    return {
        "total_messages": total,
        "by_channel": by_channel,
        "by_status": by_status,
        "generated_at": utc_now(),
    }
