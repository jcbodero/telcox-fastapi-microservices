import logging
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class OrderPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class OrderResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Provisioning Service",
    description="CRUD basico de ordenes de provision para altas, cambios de plan y servicios adicionales.",
    version="1.0.0",
    docs_url="/provisioning-service/docs",
    openapi_url="/provisioning-service/openapi.json",
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
    port = os.environ.get("PORT", "8004")
    logging.info(f"Provisioning Service starting on port {port}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_order(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


orders: dict[str, dict[str, Any]] = {
    "ord-3001": build_order(
        {
            "id": "ord-3001",
            "customer_id": "cus-1001",
            "product_id": "prd-5g-20gb",
            "operation": "activate",
            "status": "pending",
            "channel": "web",
        }
    )
}


@app.get("/provisioning-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Provisioning Service"}


@app.get("/provisioning-service/orders", response_model=list[OrderResponse], tags=["orders"])
def list_orders() -> list[dict[str, Any]]:
    return list(orders.values())


@app.post("/provisioning-service/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, tags=["orders"])
def create_order(payload: OrderPayload) -> dict[str, Any]:
    order = build_order(payload.data)
    operation = order.get("operation", "activate")
    order["status"] = "completed" if operation in {"activate", "change_plan", "suspend"} else "pending"
    orders[order["id"]] = order
    if order["status"] == "completed":
        try:
            requests.post(
                "http://localhost:8008/service-status-service/active-services",
                json={"data": {
                    "customer_id": order.get("customer_id"),
                    "product_id": order.get("product_id"),
                    "status": "active" if operation == "activate" else order.get("status"),
                    "data_used_gb": order.get("data_limit_gb", 0),
                    "data_limit_gb": order.get("data_limit_gb", 20),
                    "balance": 0,
                }},
                timeout=2,
            )
        except requests.RequestException:
            logging.warning("Could not notify service-status-service")
    return order


@app.get("/provisioning-service/orders/{order_id}", response_model=OrderResponse, tags=["orders"])
def get_order(order_id: str) -> dict[str, Any]:
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")
    return orders[order_id]


@app.put("/provisioning-service/orders/{order_id}", response_model=OrderResponse, tags=["orders"])
def replace_order(order_id: str, payload: OrderPayload) -> dict[str, Any]:
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")
    order = build_order({**payload.data, "id": order_id, "created_at": orders[order_id]["created_at"], "updated_at": utc_now()})
    orders[order_id] = order
    return order


@app.patch("/provisioning-service/orders/{order_id}", response_model=OrderResponse, tags=["orders"])
def update_order(order_id: str, payload: OrderPayload) -> dict[str, Any]:
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")
    orders[order_id] = {**orders[order_id], **payload.data, "id": order_id, "updated_at": utc_now()}
    return orders[order_id]


@app.delete("/provisioning-service/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["orders"])
def delete_order(order_id: str) -> None:
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")
    del orders[order_id]

