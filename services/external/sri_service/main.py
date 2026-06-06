import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SriValidatePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class SriAuthorizationPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class SriAuthorizationResponse(BaseModel):
    status: str
    sri_access_key: str
    authorized_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TelcoX External — SRI Authorization Service",
    description=(
        "Mockup externo del SRI (Servicio de Rentas Internas) de Ecuador. "
        "Valida y autoriza comprobantes electrónicos (facturas) conforme al "
        "esquema de facturación electrónica del SRI. "
        "Emite claves de acceso de 49 dígitos según la normativa ecuatoriana."
    ),
    version="2.0.0",
    docs_url="/sri-service/docs",
    openapi_url="/sri-service/openapi.json",
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

authorizations: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_latency() -> None:
    """Simulate realistic SRI processing latency (100–600 ms)."""
    time.sleep(random.uniform(0.10, 0.60))


def generate_sri_key() -> str:
    """Generate Ecuador's standard 49-digit numeric access key (clave de acceso)."""
    return "".join([str(random.randint(0, 9)) for _ in range(49)])


def validate_ruc_cedula(document: str | None) -> bool:
    """Basic structural validation of Ecuador RUC/cédula."""
    if not document:
        return False
    doc = str(document).strip()
    if not doc.isdigit():
        return False
    return len(doc) in (10, 13)  # cédula=10, RUC=13


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8010")
    logging.info("External SRI Service starting on port %s", port)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/sri-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "External SRI Authorization Service"}


@app.post(
    "/sri-service/validate",
    status_code=status.HTTP_200_OK,
    tags=["sri"],
)
def validate_invoice(payload: SriValidatePayload) -> dict[str, Any]:
    """
    Validación previa de los datos del comprobante antes de solicitar autorización.

    Campos esperados en `data`:
    - `invoice_id` (str, requerido)
    - `issuer_ruc` (str, requerido) — RUC del emisor (13 dígitos)
    - `customer_document` (str, opcional) — cédula/RUC del receptor
    - `amount` (float, requerido) — valor total del comprobante
    - `currency` (str, default "USD")
    - `emission_date` (str, opcional) — fecha de emisión ISO
    """
    data = payload.data
    invoice_id = data.get("invoice_id")
    issuer_ruc = str(data.get("issuer_ruc", ""))
    amount = data.get("amount")

    errors = []
    if not invoice_id:
        errors.append("invoice_id es requerido")
    if not validate_ruc_cedula(issuer_ruc):
        errors.append("issuer_ruc inválido — debe ser RUC de 13 dígitos")
    if amount is None or float(amount) <= 0:
        errors.append("amount debe ser mayor que 0")

    if errors:
        raise HTTPException(
            status_code=422,
            detail={"validation_errors": errors, "invoice_id": invoice_id},
        )

    return {
        "invoice_id": invoice_id,
        "validation_status": "valid",
        "issuer_ruc": issuer_ruc,
        "amount": amount,
        "currency": data.get("currency", "USD"),
        "validated_at": utc_now(),
        "can_proceed_to_authorization": True,
    }


@app.post(
    "/sri-service/authorizations",
    response_model=SriAuthorizationResponse,
    status_code=status.HTTP_200_OK,
    tags=["sri"],
)
def authorize_invoice(payload: SriAuthorizationPayload) -> dict[str, Any]:
    """
    Solicita la autorización del comprobante electrónico al SRI.

    Campos esperados en `data`:
    - `invoice_id` (str, requerido)
    - `issuer_ruc` (str, opcional) — RUC del emisor
    - `amount` (float, opcional) — valor total
    - `currency` (str, default "USD")
    - `mode` ("success" | "fail", default "success") — forzar resultado
    """
    simulate_latency()
    data = payload.data
    invoice_id = data.get("invoice_id")
    if not invoice_id:
        raise HTTPException(status_code=400, detail="Missing invoice_id in payload data")

    mode = data.get("mode", "success")
    if mode == "fail":
        raise HTTPException(
            status_code=503,
            detail={
                "error": "sri_service_unavailable",
                "reason": "El servicio SRI se encuentra en mantenimiento",
                "retry_after_seconds": 120,
            },
        )

    access_key = generate_sri_key()
    record = {
        "invoice_id": invoice_id,
        "sri_access_key": access_key,
        "status": "authorized",
        "authorized_at": utc_now(),
        "issuer_ruc": data.get("issuer_ruc"),
        "amount": data.get("amount"),
        "currency": data.get("currency", "USD"),
        "authorization_number": f"SRI-{str(uuid4())[:8].upper()}",
    }
    authorizations[access_key] = record
    return {
        "status": "authorized",
        "sri_access_key": access_key,
        "authorized_at": record["authorized_at"],
    }


@app.get(
    "/sri-service/authorizations/{access_key}",
    tags=["sri"],
)
def get_authorization(access_key: str) -> dict[str, Any]:
    """Consulta el estado de una autorización por su clave de acceso de 49 dígitos."""
    record = authorizations.get(access_key)
    if not record:
        raise HTTPException(status_code=404, detail="Authorization not found for the given access key")
    return record


@app.get("/sri-service/authorizations", tags=["sri"])
def list_authorizations() -> list[dict[str, Any]]:
    """Lista todas las autorizaciones emitidas en esta sesión."""
    return list(authorizations.values())
