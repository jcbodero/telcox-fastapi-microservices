from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


class ProductPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class ProductResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


app = FastAPI(
    title="TelcoX Catalog Service",
    description="CRUD basico del catalogo de planes, paquetes y servicios adicionales.",
    version="1.0.0",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_product(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {"id": data.get("id", str(uuid4())), "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}


products: dict[str, dict[str, Any]] = {
    "prd-5g-20gb": build_product(
        {
            "id": "prd-5g-20gb",
            "name": "Plan 5G 20GB",
            "type": "mobile_plan",
            "monthly_price": 24.99,
            "currency": "USD",
            "features": ["20GB data", "unlimited calls", "sms included"],
        }
    )
}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Catalog Service"}


@app.get("/products", response_model=list[ProductResponse], tags=["products"])
def list_products() -> list[dict[str, Any]]:
    return list(products.values())


@app.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, tags=["products"])
def create_product(payload: ProductPayload) -> dict[str, Any]:
    product = build_product(payload.data)
    products[product["id"]] = product
    return product


@app.get("/products/{product_id}", response_model=ProductResponse, tags=["products"])
def get_product(product_id: str) -> dict[str, Any]:
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    return products[product_id]


@app.put("/products/{product_id}", response_model=ProductResponse, tags=["products"])
def replace_product(product_id: str, payload: ProductPayload) -> dict[str, Any]:
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    product = build_product({**payload.data, "id": product_id, "created_at": products[product_id]["created_at"], "updated_at": utc_now()})
    products[product_id] = product
    return product


@app.patch("/products/{product_id}", response_model=ProductResponse, tags=["products"])
def update_product(product_id: str, payload: ProductPayload) -> dict[str, Any]:
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    products[product_id] = {**products[product_id], **payload.data, "id": product_id, "updated_at": utc_now()}
    return products[product_id]


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["products"])
def delete_product(product_id: str) -> None:
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    del products[product_id]
