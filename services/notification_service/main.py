import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class NotificationPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    customer_id: str | None = None
    channel: str | None = None
    event_type: str | None = None
    message: str | None = None
    status: str | None = None
    attempts: int | None = None
    gateway_message_id: str | None = None
    gateway_provider: str | None = None
    gateway_error: str | None = None
    external_system: str | None = None
    external_url: str | None = None
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Notification Service",
    description="CRUD de notificaciones multicanal (SMS, email, push) con integración al Notification Gateway Mock externo (puerto 8014).",
    version="2.0.0",
    docs_url="/notification-service/docs",
    openapi_url="/notification-service/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# External system config
# ---------------------------------------------------------------------------

NOTIFICATION_GATEWAY_URL = os.environ.get("NOTIFICATION_GATEWAY_URL", "http://localhost:8014")


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8005")
    logging.info(f"Notification Service starting on port {port}")
    logging.info(f"Notification Gateway URL: {NOTIFICATION_GATEWAY_URL}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_notification(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


notifications: dict[str, dict[str, Any]] = {
    "ntf-5001": build_notification(
        {
            "id": "ntf-5001",
            "customer_id": "cus-1001",
            "channel": "email",
            "event_type": "payment_approved",
            "message": "Pago aprobado por USD 24.99",
            "status": "sent",
            "attempts": 1,
        }
    )
}


@app.get("/notification-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Notification Service"}


@app.get("/notification-service/notifications", response_model=list[NotificationResponse], tags=["notifications"])
def list_notifications() -> list[dict[str, Any]]:
    return list(notifications.values())


@app.post("/notification-service/notifications", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED, tags=["notifications"])
def create_notification(payload: NotificationPayload) -> dict[str, Any]:
    notification = build_notification(payload.data)
    notifications[notification["id"]] = notification
    return notification


@app.post("/notification-service/notifications/send", response_model=NotificationResponse, status_code=status.HTTP_200_OK, tags=["notifications"])
def send_notification(payload: NotificationPayload) -> dict[str, Any]:
    """Envía una notificación a través del Notification Gateway externo.

    Campos esperados en `data`:
    - `channel` ("sms" | "email" | "push")
    - `recipient` — teléfono, email o device_token
    - `message` — contenido
    - `event_type` (opcional)
    - `customer_id` (opcional)
    - `mode` ("success" | "fail", default "success")
    """
    data = payload.data
    mode = data.get("mode", "success")

    # --- Call External Notification Gateway ---
    gateway_message_id: str | None = None
    gateway_provider: str | None = None
    gateway_error: str | None = None
    final_status: str

    try:
        gw_response = requests.post(
            f"{NOTIFICATION_GATEWAY_URL}/notification-gateway/send",
            json={"data": {
                "channel": data.get("channel", "email"),
                "recipient": data.get("recipient", data.get("customer_id", "unknown")),
                "message": data.get("message", ""),
                "event_type": data.get("event_type"),
                "customer_id": data.get("customer_id"),
                "template_id": data.get("template_id"),
                "mode": mode,
            }},
            timeout=5,
        )
        if gw_response.status_code == 200:
            gw_data = gw_response.json()
            gateway_message_id = gw_data.get("message_id")
            gateway_provider = gw_data.get("provider")
            final_status = "delivered"
        else:
            gw_data = gw_response.json()
            gateway_error = str(gw_data.get("detail", "gateway_error"))
            final_status = "failed"
    except requests.RequestException as exc:
        logging.warning("Notification gateway unreachable: %s — falling back to local mock", exc)
        final_status = "delivered" if mode == "success" else "failed"
        gateway_error = "gateway_unreachable" if mode != "success" else None

    notification = build_notification({
        **data,
        "status": final_status,
        "attempts": data.get("attempts", 1),
        "gateway_message_id": gateway_message_id,
        "gateway_provider": gateway_provider,
        "gateway_error": gateway_error,
        "external_system": "notification_gateway_mock",
        "external_url": NOTIFICATION_GATEWAY_URL,
    })
    notifications[notification["id"]] = notification
    return notification


@app.get("/notification-service/notifications/{notification_id}", response_model=NotificationResponse, tags=["notifications"])
def get_notification(notification_id: str) -> dict[str, Any]:
    if notification_id not in notifications:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notifications[notification_id]


@app.put("/notification-service/notifications/{notification_id}", response_model=NotificationResponse, tags=["notifications"])
def replace_notification(notification_id: str, payload: NotificationPayload) -> dict[str, Any]:
    if notification_id not in notifications:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification = build_notification({**payload.data, "id": notification_id, "created_at": notifications[notification_id]["created_at"], "updated_at": utc_now()})
    notifications[notification_id] = notification
    return notification


@app.patch("/notification-service/notifications/{notification_id}", response_model=NotificationResponse, tags=["notifications"])
def update_notification(notification_id: str, payload: NotificationPayload) -> dict[str, Any]:
    if notification_id not in notifications:
        raise HTTPException(status_code=404, detail="Notification not found")
    notifications[notification_id] = {**notifications[notification_id], **payload.data, "id": notification_id, "updated_at": utc_now()}
    return notifications[notification_id]


@app.delete("/notification-service/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["notifications"])
def delete_notification(notification_id: str) -> None:
    if notification_id not in notifications:
        raise HTTPException(status_code=404, detail="Notification not found")
    del notifications[notification_id]
