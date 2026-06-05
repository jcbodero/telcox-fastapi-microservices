from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class CustomerPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class CustomerResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Customer Service",
    description="CRUD basico de clientes TelcoX. Simula la consulta de datos del BSS.",
    version="1.0.0",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_customer(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "id": data.get("id", str(uuid4())),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


customers: dict[str, dict[str, Any]] = {
    "cus-1001": build_customer(
        {
            "id": "cus-1001",
            "document_id": "0912345678",
            "full_name": "Ana Torres",
            "email": "ana.torres@example.com",
            "phone": "+593987654321",
            "status": "active",
            "segment": "postpaid",
        }
    )
}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Customer Service"}


@app.get("/customers", response_model=list[CustomerResponse], tags=["customers"])
def list_customers() -> list[dict[str, Any]]:
    return list(customers.values())


@app.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED, tags=["customers"])
def create_customer(payload: CustomerPayload) -> dict[str, Any]:
    customer = build_customer(payload.data)
    customers[customer["id"]] = customer
    return customer


@app.get("/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
def get_customer(customer_id: str) -> dict[str, Any]:
    if customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customers[customer_id]


@app.put("/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
def replace_customer(customer_id: str, payload: CustomerPayload) -> dict[str, Any]:
    if customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer = build_customer(
        {
            **payload.data,
            "id": customer_id,
            "created_at": customers[customer_id]["created_at"],
            "updated_at": utc_now(),
        }
    )
    customers[customer_id] = customer
    return customer


@app.patch("/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
def update_customer(customer_id: str, payload: CustomerPayload) -> dict[str, Any]:
    if customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    customers[customer_id] = {**customers[customer_id], **payload.data, "id": customer_id, "updated_at": utc_now()}
    return customers[customer_id]


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["customers"])
def delete_customer(customer_id: str) -> None:
    if customer_id not in customers:
        raise HTTPException(status_code=404, detail="Customer not found")
    del customers[customer_id]
