from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class NotificationPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Notification Service",
    description="CRUD basico de notificaciones multicanal: SMS, email y push.",
    version="1.0.0",
    docs_url="/notification-service/docs",
    openapi_url="/notification-service/openapi.json",
)


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

