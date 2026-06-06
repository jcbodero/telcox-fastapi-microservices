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

class ChargePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class RefundPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class TransactionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    transaction_id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TelcoX External — Payment Gateway Mock",
    description=(
        "Simula una pasarela de pagos PSP (Visa/Mastercard/local acquirer). "
        "Recibe cobros, devuelve authorization_code y transaction_id. "
        "Acepta `mode: fail` en el payload para simular declines."
    ),
    version="1.0.0",
    docs_url="/payment-gateway/docs",
    openapi_url="/payment-gateway/openapi.json",
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

transactions: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_latency() -> None:
    """Simulate realistic PSP network latency (50–350 ms)."""
    time.sleep(random.uniform(0.05, 0.35))


def build_transaction(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "transaction_id": data.get("transaction_id", f"txn-{str(uuid4())[:12]}"),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8011")
    logging.info("External Payment Gateway Mock starting on port %s", port)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/payment-gateway/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "External Payment Gateway Mock"}


@app.post(
    "/payment-gateway/charge",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
    tags=["transactions"],
)
def charge(payload: ChargePayload) -> dict[str, Any]:
    """
    Procesa un cobro.

    Campos esperados en `data`:
    - `amount` (float, requerido)
    - `currency` (str, default "USD")
    - `card_token` o `payment_method` (str, opcional — referencia tokenizada)
    - `customer_id` (str, opcional)
    - `invoice_id` (str, opcional)
    - `mode` ("success" | "fail", default "success")
    """
    simulate_latency()
    data = payload.data
    amount = data.get("amount")
    if amount is None:
        raise HTTPException(status_code=400, detail="Missing required field: amount")

    mode = data.get("mode", "success")
    approved = mode != "fail"

    txn = build_transaction({
        "amount": amount,
        "currency": data.get("currency", "USD"),
        "customer_id": data.get("customer_id"),
        "invoice_id": data.get("invoice_id"),
        "payment_method": data.get("card_token", data.get("payment_method", "card_token_mock")),
        "status": "approved" if approved else "declined",
        "authorization_code": f"AUTH-{str(uuid4())[:8].upper()}" if approved else None,
        "decline_reason": None if approved else "insufficient_funds",
        "gateway": "telcox-psp-mock-v1",
        "network": "visa" if approved else "mastercard",
    })
    transactions[txn["transaction_id"]] = txn

    if not approved:
        raise HTTPException(
            status_code=402,
            detail={
                "transaction_id": txn["transaction_id"],
                "status": "declined",
                "decline_reason": txn["decline_reason"],
            },
        )
    return txn


@app.post(
    "/payment-gateway/refund",
    response_model=TransactionResponse,
    status_code=status.HTTP_200_OK,
    tags=["transactions"],
)
def refund(payload: RefundPayload) -> dict[str, Any]:
    """
    Reversa/reembolso de una transacción.

    Campos esperados en `data`:
    - `original_transaction_id` (str, requerido)
    - `amount` (float, opcional — si ausente se reembolsa el total)
    - `reason` (str, opcional)
    """
    simulate_latency()
    data = payload.data
    original_id = data.get("original_transaction_id")
    if not original_id:
        raise HTTPException(status_code=400, detail="Missing required field: original_transaction_id")

    original = transactions.get(original_id)
    if not original:
        raise HTTPException(status_code=404, detail="Original transaction not found")

    if original["status"] != "approved":
        raise HTTPException(status_code=409, detail="Only approved transactions can be refunded")

    refund_amount = data.get("amount", original["amount"])
    txn = build_transaction({
        "type": "refund",
        "original_transaction_id": original_id,
        "amount": refund_amount,
        "currency": original.get("currency", "USD"),
        "customer_id": original.get("customer_id"),
        "status": "refunded",
        "authorization_code": f"REF-{str(uuid4())[:8].upper()}",
        "reason": data.get("reason", "customer_request"),
        "gateway": "telcox-psp-mock-v1",
    })
    transactions[txn["transaction_id"]] = txn
    # Mark original as refunded
    transactions[original_id]["status"] = "refunded"
    return txn


@app.get(
    "/payment-gateway/transactions/{transaction_id}",
    response_model=TransactionResponse,
    tags=["transactions"],
)
def get_transaction(transaction_id: str) -> dict[str, Any]:
    """Consulta el estado de una transacción por su ID."""
    txn = transactions.get(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@app.get("/payment-gateway/transactions", tags=["transactions"])
def list_transactions() -> list[dict[str, Any]]:
    """Lista todas las transacciones registradas en esta sesión."""
    return list(transactions.values())
