from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class OnboardingCasePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class OnboardingCaseResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Onboarding Service",
    description="CRUD basico de solicitudes de onboarding con documento y biometria facial.",
    version="1.0.0",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_onboarding_case(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


onboarding_cases: dict[str, dict[str, Any]] = {
    "onb-2001": build_onboarding_case(
        {
            "id": "onb-2001",
            "document_id": "0912345678",
            "full_name": "Ana Torres",
            "document_check": "approved",
            "face_match": "approved",
            "status": "completed",
        }
    )
}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Onboarding Service"}


@app.get("/onboarding-cases", response_model=list[OnboardingCaseResponse], tags=["onboarding-cases"])
def list_onboarding_cases() -> list[dict[str, Any]]:
    return list(onboarding_cases.values())


@app.post("/onboarding-cases", response_model=OnboardingCaseResponse, status_code=status.HTTP_201_CREATED, tags=["onboarding-cases"])
def create_onboarding_case(payload: OnboardingCasePayload) -> dict[str, Any]:
    onboarding_case = build_onboarding_case(payload.data)
    onboarding_cases[onboarding_case["id"]] = onboarding_case
    return onboarding_case


@app.get("/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
def get_onboarding_case(case_id: str) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    return onboarding_cases[case_id]


@app.put("/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
def replace_onboarding_case(case_id: str, payload: OnboardingCasePayload) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    onboarding_case = build_onboarding_case({**payload.data, "id": case_id, "created_at": onboarding_cases[case_id]["created_at"], "updated_at": utc_now()})
    onboarding_cases[case_id] = onboarding_case
    return onboarding_case


@app.patch("/onboarding-cases/{case_id}", response_model=OnboardingCaseResponse, tags=["onboarding-cases"])
def update_onboarding_case(case_id: str, payload: OnboardingCasePayload) -> dict[str, Any]:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    onboarding_cases[case_id] = {**onboarding_cases[case_id], **payload.data, "id": case_id, "updated_at": utc_now()}
    return onboarding_cases[case_id]


@app.delete("/onboarding-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["onboarding-cases"])
def delete_onboarding_case(case_id: str) -> None:
    if case_id not in onboarding_cases:
        raise HTTPException(status_code=404, detail="Onboarding case not found")
    del onboarding_cases[case_id]
