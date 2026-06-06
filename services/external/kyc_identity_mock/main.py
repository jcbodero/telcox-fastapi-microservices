import hashlib
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

class KycVerifyPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class FaceMatchPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class VerificationResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    verification_id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TelcoX External — KYC Identity Mock",
    description=(
        "Simula un proveedor externo de KYC (Know Your Customer) y verificación biométrica "
        "al estilo Onfido / Jumio / Veriff. Valida documentos de identidad, realiza "
        "face-match y liveness check. Retorna un `verification_id` con el dictamen final."
    ),
    version="1.0.0",
    docs_url="/kyc/docs",
    openapi_url="/kyc/openapi.json",
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

verifications: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_latency() -> None:
    """Simulate realistic KYC provider processing latency (200 ms – 1.2 s)."""
    time.sleep(random.uniform(0.20, 1.20))


def sha256_ref(value: str | None) -> str | None:
    """Return SHA-256 reference for a submitted image value."""
    if not value:
        return None
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()[:16] + "..."


def evaluate_document(document_id: str, has_front: bool, has_back: bool) -> dict[str, Any]:
    """Run simulated document extraction and validation."""
    if not document_id or not document_id.isdigit() or len(document_id) < 6:
        return {
            "check": "rejected",
            "reason": "invalid_document_format",
            "extracted_name": None,
        }
    if not has_front:
        return {
            "check": "rejected",
            "reason": "missing_front_image",
            "extracted_name": None,
        }
    # Simulate occasional manual review for edge documents
    last = int(document_id[-1])
    if last == 9:
        return {
            "check": "manual_review",
            "reason": "document_quality_low",
            "extracted_name": "REDACTED",
        }
    return {
        "check": "approved",
        "reason": None,
        "extracted_name": "VERIFIED_MATCH",
    }


def evaluate_face(document_check: str, has_selfie: bool, document_id: str) -> dict[str, Any]:
    """Run simulated face match and liveness detection."""
    if document_check == "rejected":
        return {"face_match": "rejected", "liveness": "rejected", "similarity_score": 0.0}
    if not has_selfie:
        return {"face_match": "rejected", "liveness": "rejected", "similarity_score": 0.0}
    last = int(document_id[-1])
    similarity = round(random.uniform(0.78, 0.99), 3)
    face_match = "approved" if last % 2 == 0 else "manual_review"
    return {
        "face_match": face_match,
        "liveness": "approved",
        "similarity_score": similarity,
    }


def build_verification(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "verification_id": data.get("verification_id", f"kyc-{str(uuid4())[:12]}"),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8013")
    logging.info("External KYC Identity Mock starting on port %s", port)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/kyc/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "External KYC Identity Mock"}


@app.post(
    "/kyc/verify",
    response_model=VerificationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["verification"],
)
def verify_identity(payload: KycVerifyPayload) -> dict[str, Any]:
    """
    Inicia una verificación de identidad completa (documento + biometría).

    Campos esperados en `data`:
    - `document_id` (str, requerido) — cédula o pasaporte
    - `full_name` (str, requerido)
    - `document_front_ref` (str, opcional) — referencia SHA-256 de la imagen del frente
    - `document_back_ref` (str, opcional) — referencia SHA-256 del reverso
    - `selfie_ref` (str, opcional) — referencia SHA-256 de la selfie
    - `consent_accepted` (bool, default False)
    - `document_type` (str, default "national_id")
    - `mode` ("success" | "fail", default "success") — forzar resultado
    """
    simulate_latency()
    data = payload.data
    document_id = str(data.get("document_id", ""))
    full_name = str(data.get("full_name", ""))

    if not document_id:
        raise HTTPException(status_code=400, detail="Missing required field: document_id")
    if not full_name:
        raise HTTPException(status_code=400, detail="Missing required field: full_name")
    if not data.get("consent_accepted", False):
        verification = build_verification({
            "document_id": document_id,
            "full_name": full_name,
            "document_type": data.get("document_type", "national_id"),
            "status": "pending_consent",
            "document_check": "pending",
            "face_match": "pending",
            "liveness": "pending",
            "risk_level": "high",
            "provider": "telcox-kyc-mock-v1",
        })
        verifications[verification["verification_id"]] = verification
        return verification

    if data.get("mode") == "fail":
        raise HTTPException(
            status_code=503,
            detail={
                "error": "kyc_provider_unavailable",
                "reason": "External KYC provider temporarily unreachable",
                "retry_after_seconds": 30,
            },
        )

    has_front = bool(data.get("document_front_ref") or data.get("document_front_image"))
    has_back = bool(data.get("document_back_ref") or data.get("document_back_image"))
    has_selfie = bool(data.get("selfie_ref") or data.get("selfie_image"))

    doc_eval = evaluate_document(document_id, has_front, has_back)
    face_eval = evaluate_face(doc_eval["check"], has_selfie, document_id)

    if doc_eval["check"] == "approved" and face_eval["face_match"] == "approved":
        final_status = "completed"
        risk_level = "low"
    elif doc_eval["check"] == "approved" and face_eval["face_match"] == "manual_review":
        final_status = "manual_review"
        risk_level = "medium"
    else:
        final_status = "rejected"
        risk_level = "high"

    verification = build_verification({
        "document_id": document_id,
        "full_name": full_name,
        "document_type": data.get("document_type", "national_id"),
        "document_front_ref": data.get("document_front_ref"),
        "document_back_ref": data.get("document_back_ref"),
        "selfie_ref": data.get("selfie_ref"),
        "status": final_status,
        "document_check": doc_eval["check"],
        "document_check_reason": doc_eval.get("reason"),
        "face_match": face_eval["face_match"],
        "liveness": face_eval["liveness"],
        "similarity_score": face_eval["similarity_score"],
        "risk_level": risk_level,
        "consent_accepted": data.get("consent_accepted", False),
        "provider": "telcox-kyc-mock-v1",
        "provider_reference": f"EXT-{str(uuid4())[:8].upper()}",
    })
    verifications[verification["verification_id"]] = verification
    return verification


@app.post(
    "/kyc/face-match",
    response_model=VerificationResponse,
    status_code=status.HTTP_200_OK,
    tags=["verification"],
)
def face_match(payload: FaceMatchPayload) -> dict[str, Any]:
    """
    Realiza solo la comparación facial (sin re-validar documento).

    Campos esperados en `data`:
    - `document_id` (str, requerido)
    - `selfie_ref` (str, requerido)
    - `original_verification_id` (str, opcional) — para vincular al KYC original
    """
    simulate_latency()
    data = payload.data
    document_id = str(data.get("document_id", ""))
    selfie_ref = data.get("selfie_ref")

    if not document_id:
        raise HTTPException(status_code=400, detail="Missing required field: document_id")
    if not selfie_ref:
        raise HTTPException(status_code=400, detail="Missing required field: selfie_ref")

    face_eval = evaluate_face("approved", True, document_id)
    verification = build_verification({
        "type": "face_match_only",
        "document_id": document_id,
        "selfie_ref": selfie_ref,
        "original_verification_id": data.get("original_verification_id"),
        "status": "completed" if face_eval["face_match"] == "approved" else "manual_review",
        "face_match": face_eval["face_match"],
        "liveness": face_eval["liveness"],
        "similarity_score": face_eval["similarity_score"],
        "provider": "telcox-kyc-mock-v1",
        "provider_reference": f"FM-{str(uuid4())[:8].upper()}",
    })
    verifications[verification["verification_id"]] = verification
    return verification


@app.get(
    "/kyc/verify/{verification_id}",
    response_model=VerificationResponse,
    tags=["verification"],
)
def get_verification(verification_id: str) -> dict[str, Any]:
    """Consulta el estado de una verificación por su ID."""
    v = verifications.get(verification_id)
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    return v


@app.get("/kyc/verify", tags=["verification"])
def list_verifications() -> list[dict[str, Any]]:
    """Lista todas las verificaciones registradas en esta sesión."""
    return list(verifications.values())
