import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class InvoicePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Billing Service",
    description="CRUD de facturas con integración al SRI externo (puerto 8010) para autorización de comprobantes electrónicos.",
    version="2.0.0",
    docs_url="/billing-service/docs",
    openapi_url="/billing-service/openapi.json",
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

SRI_SERVICE_URL = os.environ.get("SRI_SERVICE_URL", "http://localhost:8010")


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8006")
    logging.info(f"Billing Service starting on port {port}")
    logging.info(f"SRI Service URL: {SRI_SERVICE_URL}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_invoice(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


def _call_sri_authorize(invoice_id: str, amount: float | None, currency: str, issuer_ruc: str | None, mode: str) -> dict[str, Any]:
    """Call SRI external service to authorize an electronic invoice.

    Returns a dict with: sri_status, sri_access_key, sri_authorized_at, sri_error.
    """
    try:
        resp = requests.post(
            f"{SRI_SERVICE_URL}/sri-service/authorizations",
            json={"data": {
                "invoice_id": invoice_id,
                "amount": amount,
                "currency": currency,
                "issuer_ruc": issuer_ruc or "1791234560001",
                "mode": mode,
            }},
            timeout=5,
        )
        if resp.status_code == 200:
            sri_data = resp.json()
            return {
                "sri_status": "authorized",
                "sri_access_key": sri_data.get("sri_access_key"),
                "sri_authorized_at": sri_data.get("authorized_at"),
                "sri_error": None,
                "external_system": "sri_service",
                "external_url": SRI_SERVICE_URL,
            }
        else:
            detail = resp.json().get("detail", "sri_error")
            return {
                "sri_status": "rejected",
                "sri_access_key": None,
                "sri_authorized_at": None,
                "sri_error": str(detail),
                "external_system": "sri_service",
                "external_url": SRI_SERVICE_URL,
            }
    except requests.RequestException as exc:
        logging.warning("SRI service unreachable: %s — invoice marked as sri_pending", exc)
        return {
            "sri_status": "pending",
            "sri_access_key": None,
            "sri_authorized_at": None,
            "sri_error": "sri_service_unreachable",
            "external_system": "sri_service",
            "external_url": SRI_SERVICE_URL,
        }


invoices: dict[str, dict[str, Any]] = {
    "inv-2026-0001": build_invoice(
        {
            "id": "inv-2026-0001",
            "customer_id": "cus-1001",
            "amount": 24.99,
            "currency": "USD",
            "status": "issued",
            "due_date": "2026-06-30",
            "sri_status": "pending",
        }
    )
}


@app.get("/billing-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Billing Service"}


@app.get("/billing-service/invoices", response_model=list[InvoiceResponse], tags=["invoices"])
def list_invoices() -> list[dict[str, Any]]:
    return list(invoices.values())


@app.post("/billing-service/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED, tags=["invoices"])
def create_invoice(payload: InvoicePayload) -> dict[str, Any]:
    invoice = build_invoice(payload.data)
    invoices[invoice["id"]] = invoice
    return invoice


@app.post("/billing-service/invoices/generate", response_model=InvoiceResponse, status_code=status.HTTP_200_OK, tags=["invoices"])
def generate_invoice(payload: InvoicePayload) -> dict[str, Any]:
    """Genera una factura y la envía al SRI para autorización electrónica."""
    data = payload.data
    due_date = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    invoice = build_invoice({
        **data,
        "status": "issued",
        "due_date": data.get("due_date", due_date),
        "sri_status": data.get("sri_status", "pending"),
    })
    invoices[invoice["id"]] = invoice

    # --- Call External SRI Service for authorization ---
    sri_result = _call_sri_authorize(
        invoice_id=invoice["id"],
        amount=data.get("amount"),
        currency=data.get("currency", "USD"),
        issuer_ruc=data.get("issuer_ruc"),
        mode=data.get("mode", "success"),
    )
    invoice.update(sri_result)
    invoice["updated_at"] = utc_now()
    invoices[invoice["id"]] = invoice
    return invoice


@app.get("/billing-service/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def get_invoice(invoice_id: str) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoices[invoice_id]


@app.put("/billing-service/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def replace_invoice(invoice_id: str, payload: InvoicePayload) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice = build_invoice({**payload.data, "id": invoice_id, "created_at": invoices[invoice_id]["created_at"], "updated_at": utc_now()})
    invoices[invoice_id] = invoice
    return invoice


@app.patch("/billing-service/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def update_invoice(invoice_id: str, payload: InvoicePayload) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoices[invoice_id] = {**invoices[invoice_id], **payload.data, "id": invoice_id, "updated_at": utc_now()}
    return invoices[invoice_id]


@app.delete("/billing-service/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["invoices"])
def delete_invoice(invoice_id: str) -> None:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    del invoices[invoice_id]
