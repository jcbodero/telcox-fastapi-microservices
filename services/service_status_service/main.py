from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class ActiveServicePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class ActiveServiceResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Service Status Service",
    description="CRUD basico para servicios activos, uso de datos, saldo y estado operativo.",
    version="1.0.0",
    docs_url="/service-status-service/docs",
    openapi_url="/service-status-service/openapi.json",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_active_service(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


active_services: dict[str, dict[str, Any]] = {
    "svc-7001": build_active_service(
        {
            "id": "svc-7001",
            "customer_id": "cus-1001",
            "product_id": "prd-5g-20gb",
            "status": "active",
            "data_used_gb": 8.4,
            "data_limit_gb": 20,
            "balance": 0,
        }
    )
}


@app.get("/service-status-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Service Status Service"}


@app.get("/service-status-service/active-services", response_model=list[ActiveServiceResponse], tags=["active-services"])
def list_active_services() -> list[dict[str, Any]]:
    return list(active_services.values())


@app.post("/service-status-service/active-services", response_model=ActiveServiceResponse, status_code=status.HTTP_201_CREATED, tags=["active-services"])
def create_active_service(payload: ActiveServicePayload) -> dict[str, Any]:
    active_service = build_active_service(payload.data)
    active_services[active_service["id"]] = active_service
    return active_service


@app.get("/service-status-service/active-services/{active_service_id}", response_model=ActiveServiceResponse, tags=["active-services"])
def get_active_service(active_service_id: str) -> dict[str, Any]:
    if active_service_id not in active_services:
        raise HTTPException(status_code=404, detail="Active service not found")
    return active_services[active_service_id]


@app.put("/service-status-service/active-services/{active_service_id}", response_model=ActiveServiceResponse, tags=["active-services"])
def replace_active_service(active_service_id: str, payload: ActiveServicePayload) -> dict[str, Any]:
    if active_service_id not in active_services:
        raise HTTPException(status_code=404, detail="Active service not found")
    active_service = build_active_service({**payload.data, "id": active_service_id, "created_at": active_services[active_service_id]["created_at"], "updated_at": utc_now()})
    active_services[active_service_id] = active_service
    return active_service


@app.patch("/service-status-service/active-services/{active_service_id}", response_model=ActiveServiceResponse, tags=["active-services"])
def update_active_service(active_service_id: str, payload: ActiveServicePayload) -> dict[str, Any]:
    if active_service_id not in active_services:
        raise HTTPException(status_code=404, detail="Active service not found")
    active_services[active_service_id] = {**active_services[active_service_id], **payload.data, "id": active_service_id, "updated_at": utc_now()}
    return active_services[active_service_id]


@app.delete("/service-status-service/active-services/{active_service_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["active-services"])
def delete_active_service(active_service_id: str) -> None:
    if active_service_id not in active_services:
        raise HTTPException(status_code=404, detail="Active service not found")
    del active_services[active_service_id]

