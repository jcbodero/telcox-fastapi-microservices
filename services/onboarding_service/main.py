import hashlib
import inspect
import logging
import os
import time
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class OnboardingCasePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class IdentityVerificationPayload(BaseModel):
    document_id: str = Field(min_length=6)
    full_name: str = Field(min_length=3)
    email: str | None = None
    phone: str | None = None
    document_type: str = "national_id"
    document_front_image: str | None = None
    document_back_image: str | None = None
    selfie_image: str | None = None
    consent_accepted: bool = False
    requested_auth_methods: list[str] = Field(default_factory=lambda: ["password", "passkey", "device_biometric"])


class AuthEnrollmentPayload(BaseModel):
    auth_methods: list[str] = Field(default_factory=lambda: ["password", "passkey"])


class OnboardingCaseResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "document_front_image",
    "document_back_image",
    "selfie_image",
    "biometric_template",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "***REDACTED***" if key.lower() in SENSITIVE_KEYS else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def payload_to_dict(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return redact(value.model_dump())
    if isinstance(value, dict):
        return redact(value)
    return {"value": str(value)}


class AuditManager:
    """Local audit manager for onboarding actions."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.audit_backend = os.environ.get("AUDIT_BACKEND", "memory").lower()
        self.postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
        Path("logs").mkdir(exist_ok=True)
        self.logger = logging.getLogger("onboarding-service-audit")
        if not self.logger.handlers:
            handler = logging.FileHandler("logs/onboarding-service-audit.log")
            handler.setFormatter(logging.Formatter("%(asctime)s - %(message)s"))
            self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def log_event(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        status_value: str,
        payload_in: dict[str, Any] | None = None,
        payload_out: dict[str, Any] | None = None,
        error_message: str | None = None,
        duration_ms: float = 0.0,
    ) -> str:
        event = {
            "id": str(uuid4()),
            "service": SERVICE_NAME,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "status": status_value,
            "payload_in": redact(payload_in),
            "payload_out": redact(payload_out),
            "timestamp": utc_now(),
            "duration_ms": duration_ms,
            "error_message": error_message,
            "metadata": {},
        }
        self.events.append(event)
        self.logger.info("%s", event)
        if self.audit_backend == "postgres" and self.postgres_url:
            self.save_to_postgres(event)
        return event["id"]

    def save_to_postgres(self, event: dict[str, Any]) -> None:
        try:
            import psycopg
            from psycopg.types.json import Jsonb
        except ImportError:
            logging.warning("psycopg is required for AUDIT_BACKEND=postgres")
            return

        try:
            payload = {
                **event,
                "payload_in": Jsonb(event["payload_in"]) if event["payload_in"] is not None else None,
                "payload_out": Jsonb(event["payload_out"]) if event["payload_out"] is not None else None,
                "metadata": Jsonb(event["metadata"] or {}),
            }
            with psycopg.connect(self.postgres_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO audit_events (
                            id, service, action, resource_type, resource_id,
                            status, payload_in, payload_out, timestamp,
                            duration_ms, error_message, metadata
                        )
                        VALUES (
                            %(id)s, %(service)s, %(action)s, %(resource_type)s,
                            %(resource_id)s, %(status)s, %(payload_in)s::jsonb,
                            %(payload_out)s::jsonb, %(timestamp)s,
                            %(duration_ms)s, %(error_message)s, %(metadata)s::jsonb
                        )
                        """,
                        payload,
                    )
        except Exception as exc:
            logging.warning("Onboarding audit persistence failed: %s", exc)


audit_manager = AuditManager()


def audit_action(action: str, resource_type: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            bound_arguments = inspect.signature(func).bind_partial(*args, **kwargs)
            bound_arguments.apply_defaults()
            resource_id = (
                bound_arguments.arguments.get("case_id")
                or bound_arguments.arguments.get("resource_id")
                or "unknown"
            )
            payload_in = payload_to_dict(bound_arguments.arguments.get("payload"))
            try:
                result = func(*args, **kwargs)
                if isinstance(result, dict):
                    resource_id = result.get("id", resource_id)
                audit_manager.log_event(
                    action=action,
                    resource_type=resource_type,
                    resource_id=str(resource_id),
                    status_value="SUCCESS",
                    payload_in=payload_in,
                    payload_out=payload_to_dict(result),
                    duration_ms=(time.time() - start_time) * 1000,
                )
                return result
            except Exception as exc:
                audit_manager.log_event(
                    action=action,
                    resource_type=resource_type,
                    resource_id=str(resource_id),
                    status_value="FAILED",
                    payload_in=payload_in,
                    error_message=str(exc),
                    duration_ms=(time.time() - start_time) * 1000,
                )
                raise

        return wrapper
    return decorator


app = FastAPI(
    title="TelcoX Onboarding Service",
    description="Solicitudes de onboarding con verificacion documental, facial y alta de metodos de autenticacion.",
    version="1.1.0",
    docs_url="/onboarding-service/docs",
    openapi_url="/onboarding-service/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_AUTH_METHODS = {"password", "passkey", "fingerprint", "face_auth", "device_biometric"}
IDENTITY_PROVIDER = os.environ.get("IDENTITY_PROVIDER", "keycloak")
KYC_PROVIDER = os.environ.get("KYC_PROVIDER", "mock-kyc")
FACE_PROVIDER = os.environ.get("FACE_PROVIDER", "mock-face-match")
SERVICE_NAME = "onboarding-service"


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", os.environ.get("SERVICE_PORT", "8008"))
    logging.info("Onboarding Service starting on port %s", port)


def evidence_ref(value: str | None) -> str | None:
    if not value:
        return None
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def evaluate_identity(data: dict[str, Any]) -> dict[str, Any]:
    document_id = str(data.get("document_id", ""))
    has_document_images = bool(data.get("document_front_image")) and bool(data.get("document_back_image"))
    has_selfie = bool(data.get("selfie_image"))
    consent_accepted = bool(data.get("consent_accepted"))

    document_check = "rejected"
    face_match = "rejected"
    liveness_check = "rejected"
    risk_level = "high"
    final_status = "rejected"

    if document_id.isdigit() and len(document_id) >= 6 and has_document_images:
        document_check = "approved"
    if has_selfie:
        liveness_check = "approved"
    if document_check == "approved" and liveness_check == "approved":
        last_digit = int(document_id[-1])
        face_match = "approved" if last_digit % 2 == 0 else "manual_review"
        risk_level = "low" if face_match == "approved" else "medium"
    if not consent_accepted:
        final_status = "pending_consent"
        risk_level = "high"
    elif document_check == "approved" and face_match == "approved":
        final_status = "completed"
    elif document_check == "approved" and face_match == "manual_review":
        final_status = "manual_review"

    return {
        "document_check": document_check,
        "face_match": face_match,
        "liveness_check": liveness_check,
        "risk_level": risk_level,
        "status": final_status,
    }


def allowed_auth_methods(methods: list[str]) -> list[str]:
    cleaned = []
    for method in methods:
        normalized = str(method).strip().lower()
        if normalized in SUPPORTED_AUTH_METHODS and normalized not in cleaned:
            cleaned.append(normalized)
    return cleaned or ["password"]


def build_onboarding_case(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "id": data.get("id", str(uuid4())),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


def build_identity_profile(data: dict[str, Any], verification: dict[str, Any]) -> dict[str, Any]:
    approved = verification["status"] == "completed"
    auth_methods = allowed_auth_methods(data.get("requested_auth_methods", []))
    return {
        "identity_provider": IDENTITY_PROVIDER,
        "kyc_provider": KYC_PROVIDER,
        "face_provider": FACE_PROVIDER,
        "keycloak_realm": os.environ.get("KEYCLOAK_REALM", "telcox"),
        "user_provisioning": "ready" if approved else "blocked",
        "required_actions": [] if approved else ["resolve_identity_verification"],
        "enabled_auth_methods": auth_methods if approved else [],
        "credential_policy": {
            "password": "managed_by_identity_provider",
            "passkey": "webauthn_resident_key_preferred",
            "fingerprint": "local_device_biometric_unlock",
            "face_auth": "local_device_biometric_unlock",
        },
    }


onboarding_cases: dict[str, dict[str, Any]] = {
    "onb-2001": build_onboarding_case(
        {
            "id": "onb-2001",
            "document_id": "0912345678",
            "full_name": "Ana Torres",
            "email": "ana.torres@example.com",
            "phone": "+593987654321",
            "document_type": "national_id",
            "document_check": "approved",
            "face_match": "approved",
            "liveness_check": "approved",
            "risk_level": "low",
            "status": "completed",
            "identity_provider": "keycloak",
            "user_provisioning": "ready",
            "enabled_auth_methods": ["password", "passkey", "device_biometric"],
        }
    )
}


@app.get("/onboarding-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Onboarding Service"}


@app.get("/onboarding-service/audit", tags=["audit"])
def get_audit_trail() -> list[dict[str, Any]]:
    return audit_manager.events


@app.get("/onboarding-service/security-recommendations", tags=["identity"])
def security_recommendations() -> dict[str, Any]:
    return {
        "identity_provider": ["Keycloak", "Auth0", "Okta", "Microsoft Entra External ID", "Amazon Cognito"],
        "document_and_face_verification": ["Onfido", "Jumio", "Veriff", "Facephi", "AWS Rekognition", "Azure AI Vision"],
        "recommended_architecture": {
            "web_and_mobile_login": "OIDC Authorization Code Flow with PKCE",
            "passwords": "Stored only in the identity provider, never in TelcoX services",
            "biometrics": "Use WebAuthn/passkeys or local device biometrics; never store raw biometric templates",
            "step_up_mfa": "Require MFA for payments, plan changes and personal-data updates",
        },
    }


@app.get("/onboarding-service/onboarding-cases", response_model=list[OnboardingCaseResponse], tags=["onboarding-cases"])
def list_onboarding_cases() -> list[dict[str, Any]]:
    return list(onboarding_cases.values())


@app.post("/onboarding-service/onboarding-cases", response_model=OnboardingCaseResponse, status_code=status.HTTP_201_CREATED, tags=["onboarding-cases"])
@audit_action("CREATE", "ONBOARDING_CASE")
def create_onboarding_case(payload: OnboardingCasePayload) -> dict[str, Any]:
    onboarding_case = build_onboarding_case(payload.data)
    onboarding_cases[onboarding_case["id"]] = onboarding_case
    return onboarding_case


@app.post("/onboarding-service/onboarding-cases/verify", response_model=OnboardingCaseResponse, status_code=status.HTTP_201_CREATED, tags=["identity"])
@audit_action("VERIFY", "IDENTITY")
def verify_onboarding(payload: IdentityVerificationPayload) -> dict[str, Any]:
    data = payload.model_dump()
    verification = evaluate_identity(data)
    identity_profile = build_identity_profile(data, verification)
    case = build_onboarding_case(
        {
            "document_id": data["document_id"],
            "full_name": data["full_name"],
            "email": data.get("email"),
            "phone": data.get("phone"),
            "document_type": data.get("document_type"),
            "document_front_ref": evidence_ref(data.get("document_front_image")),
            "document_back_ref": evidence_ref(data.get("document_back_image")),
            "selfie_ref": evidence_ref(data.get("selfie_image")),
            "consent_accepted": data.get("consent_accepted"),
            **verification,
            **identity_profile,
        }
    )
    onboarding_cases[case["id"]] = case
    return case


@app.post("/onboarding-service/onboarding-cases/{case_id}/auth-methods", response_model=OnboardingCaseResponse, tags=["identity"])
@audit_action("UPDATE", "AUTH_METHODS")
def enroll_auth_methods(case_id: str, payload: AuthEnrollmentPayload) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")

    case = onboarding_cases[case_id]
    if case.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Identity verification must be completed before auth enrollment")

    methods = allowed_auth_methods(payload.auth_methods)
    onboarding_cases[case_id] = {
        **case,
        "enabled_auth_methods": methods,
        "updated_at": utc_now(),
    }
    return onboarding_cases[case_id]


@app.get("/onboarding-service/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
def get_onboarding_case(case_id: str) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    return onboarding_cases[case_id]


@app.put("/onboarding-service/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
def replace_onboarding_case(case_id: str, payload: OnboardingCasePayload) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    onboarding_case = build_onboarding_case(
        {
            **payload.data,
            "id": case_id,
            "created_at": onboarding_cases[case_id]["created_at"],
            "updated_at": utc_now(),
        }
    )
    onboarding_cases[case_id] = onboarding_case
    return onboarding_case


@app.patch("/onboarding-service/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
@audit_action("UPDATE", "ONBOARDING_CASE")
def update_onboarding_case(case_id: str, payload: OnboardingCasePayload) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    onboarding_cases[case_id] = {**onboarding_cases[case_id], **payload.data, "id": case_id, "updated_at": utc_now()}
    return onboarding_cases[case_id]


@app.delete("/onboarding-service/onboarding-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["onboarding-cases"])
@audit_action("DELETE", "ONBOARDING_CASE")
def delete_onboarding_case(case_id: str) -> None:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    del onboarding_cases[case_id]
