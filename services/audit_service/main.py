import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware


class AuditEventPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


class AuditRetentionRequest(BaseModel):
    older_than_days: int = Field(default=90, ge=1, le=3650)


SENSITIVE_KEYS = {"password", "token", "access_token", "refresh_token", "authorization", "biometric_template", "selfie_image", "document_front_image", "document_back_image"}


app = FastAPI(
    title="TelcoX Audit Service",
    description="CRUD basico de eventos de auditoria de acciones de usuario.",
    version="1.0.0",
    docs_url="/audit-service/docs",
    openapi_url="/audit-service/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8007")
    logging.info(f"Audit Service starting on port {port}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_audit_event(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "***REDACTED***" if key.lower() in SENSITIVE_KEYS else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


audit_events: dict[str, dict[str, Any]] = {
    "aud-8001": build_audit_event(
        {
            "id": "aud-8001",
            "actor_id": "cus-1001",
            "action": "payment.created",
            "resource": "payments/pay-9001",
            "channel": "web",
            "result": "success",
        }
    )
}


@app.get("/audit-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Audit Service"}


@app.get("/audit-service/audit-events", response_model=list[AuditEventResponse], tags=["audit-events"])
def list_audit_events() -> list[dict[str, Any]]:
    return list(audit_events.values())


@app.post("/audit-service/audit-events", response_model=AuditEventResponse, status_code=status.HTTP_201_CREATED, tags=["audit-events"])
def create_audit_event(payload: AuditEventPayload) -> dict[str, Any]:
    audit_event = build_audit_event(redact(payload.data))
    audit_events[audit_event["id"]] = audit_event
    return audit_event


@app.get("/audit-service/audit-events/{event_id}", response_model=AuditEventResponse, tags=["audit-events"])
def get_audit_event(event_id: str) -> dict[str, Any]:
    if event_id not in audit_events:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return audit_events[event_id]


@app.put("/audit-service/audit-events/{event_id}", response_model=AuditEventResponse, tags=["audit-events"])
def replace_audit_event(event_id: str, payload: AuditEventPayload) -> dict[str, Any]:
    if event_id not in audit_events:
        raise HTTPException(status_code=404, detail="Audit event not found")
    audit_event = build_audit_event({**redact(payload.data), "id": event_id, "created_at": audit_events[event_id]["created_at"], "updated_at": utc_now()})
    audit_events[event_id] = audit_event
    return audit_event


@app.patch("/audit-service/audit-events/{event_id}", response_model=AuditEventResponse, tags=["audit-events"])
def update_audit_event(event_id: str, payload: AuditEventPayload) -> dict[str, Any]:
    if event_id not in audit_events:
        raise HTTPException(status_code=404, detail="Audit event not found")
    audit_events[event_id] = {**audit_events[event_id], **redact(payload.data), "id": event_id, "updated_at": utc_now()}
    return audit_events[event_id]


@app.post("/audit-service/retention/cleanup", tags=["audit-events"])
def cleanup_old_events(payload: AuditRetentionRequest) -> dict[str, Any]:
    cutoff = datetime.now(timezone.utc).timestamp() - (payload.older_than_days * 86400)
    to_delete = []
    for event_id, event in audit_events.items():
        try:
            event_ts = datetime.fromisoformat(event["created_at"]).timestamp()
            if event_ts < cutoff:
                to_delete.append(event_id)
        except Exception:
            to_delete.append(event_id)
    for event_id in to_delete:
        del audit_events[event_id]
    return {"deleted": len(to_delete), "remaining": len(audit_events)}


@app.delete("/audit-service/audit-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["audit-events"])
def delete_audit_event(event_id: str) -> None:
    if event_id not in audit_events:
        raise HTTPException(status_code=404, detail="Audit event not found")
    del audit_events[event_id]
