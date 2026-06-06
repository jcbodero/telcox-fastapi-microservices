from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import os
import logging
import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class PaymentPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    customer_id: str | None = None
    amount: float | None = None
    currency: str | None = None
    method: str | None = None
    invoice_id: str | None = None
    status: str | None = None
    gateway_reference: str | None = None
    gateway_transaction_id: str | None = None
    gateway_authorization_code: str | None = None
    gateway_error: str | None = None
    external_system: str | None = None
    external_url: str | None = None
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Payment Service",
    description="CRUD basico de pagos e historial. Integrado con Payment Gateway Mock externo (puerto 8011).",
    version="2.0.0",
    docs_url="/payment-service/docs",
    openapi_url="/payment-service/openapi.json",
)

# Enable CORS for local UI development
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

PAYMENT_GATEWAY_URL = os.environ.get("PAYMENT_GATEWAY_URL", "http://localhost:8011")


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8003")
    logging.info(f"Payment Service starting on port {port}")
    logging.info(f"Payment Gateway URL: {PAYMENT_GATEWAY_URL}")


@app.post("/payment-service/process", response_model=PaymentResponse, status_code=status.HTTP_200_OK, tags=["payments"])
def process_payment(payload: PaymentPayload) -> dict[str, Any]:
    """Procesa un pago simulado con integración al Payment Gateway externo.

    Espera en `payload.data` las claves: `customer_id`, `amount`, `method`, opcional `mode` (\"success\"|\"fail\").
    """
    data = payload.data
    mode = data.get("mode", "success")

    # --- Call External Payment Gateway ---
    gateway_ref: str | None = None
    gateway_transaction_id: str | None = None
    gateway_auth_code: str | None = None
    gateway_error: str | None = None
    final_status: str

    try:
        gw_response = requests.post(
            f"{PAYMENT_GATEWAY_URL}/payment-gateway/charge",
            json={"data": {
                "amount": data.get("amount"),
                "currency": data.get("currency", "USD"),
                "customer_id": data.get("customer_id"),
                "invoice_id": data.get("invoice_id"),
                "payment_method": data.get("method", "card"),
                "mode": mode,
            }},
            timeout=5,
        )
        if gw_response.status_code == 200:
            gw_data = gw_response.json()
            gateway_transaction_id = gw_data.get("transaction_id")
            gateway_auth_code = gw_data.get("authorization_code")
            gateway_ref = f"gw-{gateway_transaction_id}"
            final_status = "approved"
        else:
            gw_data = gw_response.json()
            gateway_error = str(gw_data.get("detail", "gateway_declined"))
            gateway_ref = f"gw-mock-{str(uuid4())[:8]}"
            final_status = "declined"
    except requests.RequestException as exc:
        logging.warning("Payment gateway unreachable: %s — falling back to local mock", exc)
        gateway_ref = f"gw-mock-{str(uuid4())[:8]}"
        final_status = "approved" if mode == "success" else "declined"
        gateway_error = "gateway_unreachable" if mode != "success" else None

    payment = build_payment({
        "customer_id": data.get("customer_id"),
        "amount": data.get("amount"),
        "currency": data.get("currency", "USD"),
        "method": data.get("method", "card"),
        "invoice_id": data.get("invoice_id"),
        "status": final_status,
        "gateway_reference": gateway_ref,
        "gateway_transaction_id": gateway_transaction_id,
        "gateway_authorization_code": gateway_auth_code,
        "gateway_error": gateway_error,
        "external_system": "payment_gateway_mock",
        "external_url": PAYMENT_GATEWAY_URL,
    })
    payments[payment["id"]] = payment
    return payment


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
            "external_system": "payment_gateway_mock",
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
