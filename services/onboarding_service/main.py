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

import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# External system config
# ---------------------------------------------------------------------------

KYC_SERVICE_URL = os.environ.get("KYC_SERVICE_URL", "http://localhost:8013")


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
    consent_version: str = "2026-06"
    requested_auth_methods: list[str] = Field(default_factory=lambda: ["password", "passkey", "device_biometric"])


class AuthEnrollmentPayload(BaseModel):
    auth_methods: list[str] = Field(default_factory=lambda: ["password", "passkey"])
    case_data: dict[str, Any] | None = None


class ConsentPayload(BaseModel):
    user_id: str
    accepted: bool = False
    consent_version: str = "2026-06"
    consent_scope: list[str] = Field(default_factory=lambda: ["personal_data", "documents", "biometrics"])
    source: str = "web"


class OnboardingCaseResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    document_id: str | None = None
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    document_type: str | None = None
    consent_accepted: bool | None = None
    consent_version: str | None = None
    consent_accepted_at: str | None = None
    consent_scope: list[str] | None = None
    document_check: str | None = None
    face_match: str | None = None
    liveness_check: str | None = None
    risk_level: str | None = None
    status: str | None = None
    identity_provider: str | None = None
    user_provisioning: str | None = None
    enabled_auth_methods: list[str] | None = None
    kyc_verification_id: str | None = None
    kyc_provider_response: dict[str, Any] | None = None
    kyc_error: str | None = None
    external_system: str | None = None
    external_url: str | None = None
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
    "document_front_ref",
    "document_back_ref",
    "selfie_ref",
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


def build_privacy_policy() -> dict[str, Any]:
    return {
        "policy_name": "TelcoX Privacy and Biometrics Policy",
        "version": "2026-06",
        "effective_date": "2026-06-06",
        "data_categories": ["personal_data", "documents", "biometrics", "audit_logs"],
        "purposes": ["identity_verification", "service_access", "fraud_prevention", "regulatory_compliance"],
        "retention": {
            "audit_logs": "policy_based_retention",
            "kyc_evidence": "minimum_required",
            "biometric_references": "ephemeral_or_provider_managed",
        },
    }


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
    logging.info("KYC Service URL: %s", KYC_SERVICE_URL)
    logging.info("Privacy policy version: %s", build_privacy_policy()["version"])


def evidence_ref(value: str | None) -> str | None:
    if not value:
        return None
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


@app.get("/onboarding-service/privacy-policy", tags=["compliance"])
def privacy_policy() -> dict[str, Any]:
    return build_privacy_policy()


@app.post("/onboarding-service/consent", tags=["compliance"])
@audit_action("CONSENT", "PRIVACY_POLICY")
def accept_consent(payload: ConsentPayload) -> dict[str, Any]:
    if not payload.accepted:
        raise HTTPException(status_code=400, detail="Explicit consent is required")
    return {
        "id": f"consent-{payload.user_id}-{payload.consent_version}",
        "user_id": payload.user_id,
        "accepted": True,
        "consent_version": payload.consent_version,
        "consent_scope": payload.consent_scope,
        "accepted_at": utc_now(),
        "source": payload.source,
    }


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
    if not data.get("consent_accepted"):
        raise HTTPException(status_code=400, detail="Explicit consent is required before biometric onboarding")

    # --- Call External KYC Service ---
    kyc_verification_id: str | None = None
    kyc_provider_response: dict[str, Any] | None = None
    kyc_error: str | None = None
    try:
        kyc_resp = requests.post(
            f"{KYC_SERVICE_URL}/kyc/verify",
            json={"data": {
                "document_id": data.get("document_id"),
                "full_name": data.get("full_name"),
                "document_front_ref": evidence_ref(data.get("document_front_image")),
                "document_back_ref": evidence_ref(data.get("document_back_image")),
                "selfie_ref": evidence_ref(data.get("selfie_image")),
                "document_type": data.get("document_type", "national_id"),
                "consent_accepted": data.get("consent_accepted", False),
            }},
            timeout=10,
        )
        if kyc_resp.status_code in (200, 201):
            kyc_data = kyc_resp.json()
            kyc_verification_id = kyc_data.get("verification_id")
            kyc_provider_response = {
                "status": kyc_data.get("status"),
                "document_check": kyc_data.get("document_check"),
                "face_match": kyc_data.get("face_match"),
                "liveness": kyc_data.get("liveness"),
                "similarity_score": kyc_data.get("similarity_score"),
                "risk_level": kyc_data.get("risk_level"),
                "provider": kyc_data.get("provider"),
                "provider_reference": kyc_data.get("provider_reference"),
            }
        else:
            kyc_error = f"KYC HTTP {kyc_resp.status_code}"
            logging.warning("KYC service returned %s — falling back to local evaluation", kyc_resp.status_code)
    except requests.RequestException as exc:
        kyc_error = "kyc_service_unreachable"
        logging.warning("KYC service unreachable: %s — falling back to local evaluation", exc)

    # Run local evaluation as fallback / complement
    verification = evaluate_identity(data)
    identity_profile = build_identity_profile(data, verification)
    case = build_onboarding_case(
        {
            "document_id": data["document_id"],
            "full_name": data["full_name"],
            "email": data.get("email"),
            "phone": data.get("phone"),
            "document_type": data.get("document_type"),
            "consent_accepted": True,
            "consent_version": data.get("consent_version", "2026-06"),
            "consent_accepted_at": utc_now(),
            "consent_scope": ["personal_data", "documents", "biometrics"],
            "document_front_ref": evidence_ref(data.get("document_front_image")),
            "document_back_ref": evidence_ref(data.get("document_back_image")),
            "selfie_ref": evidence_ref(data.get("selfie_image")),
            "kyc_verification_id": kyc_verification_id,
            "kyc_provider_response": kyc_provider_response,
            "kyc_error": kyc_error,
            "external_system": "kyc_identity_mock",
            "external_url": KYC_SERVICE_URL,
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
        case_data = payload.case_data or {}
        if case_data.get("id") != case_id or case_data.get("status") not in ("completed", "manual_review"):
            raise HTTPException(status_code=404, detail="Onboarding case not found")
        onboarding_cases[case_id] = build_onboarding_case(case_data)

    case = onboarding_cases[case_id]
    if case.get("status") not in ("completed", "manual_review"):
        raise HTTPException(status_code=409, detail="Identity verification must be completed or in manual review before auth enrollment")

    methods = allowed_auth_methods(payload.auth_methods)
    onboarding_cases[case_id] = {
        **case,
        "status": "completed",
        "enabled_auth_methods": methods,
        "updated_at": utc_now(),
    }
    return onboarding_cases[case_id]


@app.get("/onboarding-service/privacy-export/{case_id}", tags=["compliance"])
def export_privacy_trail(case_id: str) -> dict[str, Any]:
    case = onboarding_cases.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    return {
        "case_id": case_id,
        "consent_accepted": case.get("consent_accepted"),
        "consent_version": case.get("consent_version"),
        "consent_accepted_at": case.get("consent_accepted_at"),
        "data_subject_fields": {
            "document_id": case.get("document_id"),
            "full_name": case.get("full_name"),
            "email": case.get("email"),
            "phone": case.get("phone"),
        },
        "audit_events": audit_manager.events[-50:],
    }


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
