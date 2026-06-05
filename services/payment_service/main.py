from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class PaymentPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Payment Service",
    description="CRUD basico de pagos e historial. Simula integracion con gateway de pagos.",
    version="1.0.0",
    docs_url="/payment-service/docs",
    openapi_url="/payment-service/openapi.json",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_payment(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


payments: dict[str, dict[str, Any]] = {
    "pay-9001": build_payment(
        {
            "id": "pay-9001",
            "invoice_id": "inv-2026-0001",
            "customer_id": "cus-1001",
            "amount": 24.99,
            "currency": "USD",
            "method": "card",
            "status": "approved",
            "gateway_reference": "gw-demo-123",
        }
    )
}


@app.get("/payment-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Payment Service"}


@app.get("/payment-service/payments", response_model=list[PaymentResponse], tags=["payments"])
def list_payments() -> list[dict[str, Any]]:
    return list(payments.values())


@app.post("/payment-service/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED, tags=["payments"])
def create_payment(payload: PaymentPayload) -> dict[str, Any]:
    payment = build_payment(payload.data)
    payments[payment["id"]] = payment
    return payment


@app.get("/payment-service/payments/{payment_id}", response_model=PaymentResponse, tags=["payments"])
def get_payment(payment_id: str) -> dict[str, Any]:
    if payment_id not in payments:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payments[payment_id]


@app.put("/payment-service/payments/{payment_id}", response_model=PaymentResponse, tags=["payments"])
def replace_payment(payment_id: str, payload: PaymentPayload) -> dict[str, Any]:
    if payment_id not in payments:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment = build_payment({**payload.data, "id": payment_id, "created_at": payments[payment_id]["created_at"], "updated_at": utc_now()})
    payments[payment_id] = payment
    return payment


@app.patch("/payment-service/payments/{payment_id}", response_model=PaymentResponse, tags=["payments"])
def update_payment(payment_id: str, payload: PaymentPayload) -> dict[str, Any]:
    if payment_id not in payments:
        raise HTTPException(status_code=404, detail="Payment not found")
    payments[payment_id] = {**payments[payment_id], **payload.data, "id": payment_id, "updated_at": utc_now()}
    return payments[payment_id]


@app.delete("/payment-service/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["payments"])
def delete_payment(payment_id: str) -> None:
    if payment_id not in payments:
        raise HTTPException(status_code=404, detail="Payment not found")
    del payments[payment_id]

