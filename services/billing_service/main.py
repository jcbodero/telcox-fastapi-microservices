from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
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
    description="CRUD basico de facturas y reenvio logico de comprobantes.",
    version="1.0.0",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_invoice(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


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


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Billing Service"}


@app.get("/invoices", response_model=list[InvoiceResponse], tags=["invoices"])
def list_invoices() -> list[dict[str, Any]]:
    return list(invoices.values())


@app.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED, tags=["invoices"])
def create_invoice(payload: InvoicePayload) -> dict[str, Any]:
    invoice = build_invoice(payload.data)
    invoices[invoice["id"]] = invoice
    return invoice


@app.get("/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def get_invoice(invoice_id: str) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoices[invoice_id]


@app.put("/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def replace_invoice(invoice_id: str, payload: InvoicePayload) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice = build_invoice({**payload.data, "id": invoice_id, "created_at": invoices[invoice_id]["created_at"], "updated_at": utc_now()})
    invoices[invoice_id] = invoice
    return invoice


@app.patch("/invoices/{invoice_id}", response_model=InvoiceResponse, tags=["invoices"])
def update_invoice(invoice_id: str, payload: InvoicePayload) -> dict[str, Any]:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoices[invoice_id] = {**invoices[invoice_id], **payload.data, "id": invoice_id, "updated_at": utc_now()}
    return invoices[invoice_id]


@app.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["invoices"])
def delete_invoice(invoice_id: str) -> None:
    if invoice_id not in invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    del invoices[invoice_id]
