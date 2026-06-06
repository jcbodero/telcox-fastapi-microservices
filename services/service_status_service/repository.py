from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

class ActiveServiceRepository:
    def __init__(self) -> None:
        # In-memory dictionary database
        self._db: dict[str, dict[str, Any]] = {
            "svc-7001": {
                "id": "svc-7001",
                "customer_id": "cus-1001",
                "product_id": "prd-5g-20gb",
                "status": "active",
                "data_used_gb": 8.4,
                "data_limit_gb": 20.0,
                "balance": 0.0,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
        }

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._db.values())

    def get_by_id(self, service_id: str) -> Optional[dict[str, Any]]:
        return self._db.get(service_id)

    def find_by_customer_and_product(self, customer_id: str, product_id: str) -> Optional[dict[str, Any]]:
        for service in self._db.values():
            if service.get("customer_id") == customer_id and service.get("product_id") == product_id:
                return service
        return None

    def find_by_customer(self, customer_id: str) -> Optional[dict[str, Any]]:
        for service in self._db.values():
            if service.get("customer_id") == customer_id:
                return service
        return None

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        # Business/upgrade logic: if customer already has a service and we are upgrading/changing plan
        customer_id = data.get("customer_id")
        existing_service = self.find_by_customer(customer_id) if customer_id else None

        if existing_service:
            # Update the existing service instead of creating a duplicate
            service_id = existing_service["id"]
            # If the new data limit is larger, or it is a package upgrade, add to it
            new_limit = data.get("data_limit_gb", 20.0)
            existing_limit = existing_service.get("data_limit_gb", 20.0)
            
            # If it's a packages upgrade, let's add the GBs
            if data.get("product_id", "").startswith("prd-extra"):
                updated_limit = existing_limit + new_limit
                updated_used = existing_service.get("data_used_gb", 0.0)
            else:
                updated_limit = new_limit
                updated_used = 0.0  # Reset usage for a new plan

            updated_data = {
                **existing_service,
                "product_id": data.get("product_id", existing_service["product_id"]),
                "status": data.get("status", "active"),
                "data_limit_gb": updated_limit,
                "data_used_gb": updated_used,
                "balance": data.get("balance", existing_service.get("balance", 0.0)),
                "updated_at": utc_now(),
            }
            self._db[service_id] = updated_data
            return updated_data

        # Standard creation
        service_id = data.get("id") or str(uuid4())
        now = utc_now()
        service = {
            "id": service_id,
            "created_at": data.get("created_at") or now,
            "updated_at": now,
            "customer_id": data.get("customer_id"),
            "product_id": data.get("product_id"),
            "status": data.get("status", "active"),
            "data_used_gb": float(data.get("data_used_gb", 0.0)),
            "data_limit_gb": float(data.get("data_limit_gb", 20.0)),
            "balance": float(data.get("balance", 0.0)),
        }
        self._db[service_id] = service
        return service

    def update(self, service_id: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
        if service_id not in self._db:
            return None
        now = utc_now()
        existing = self._db[service_id]
        updated = {
            **data,
            "id": service_id,
            "created_at": existing["created_at"],
            "updated_at": now,
        }
        self._db[service_id] = updated
        return updated

    def patch(self, service_id: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
        if service_id not in self._db:
            return None
        existing = self._db[service_id]
        updated = {
            **existing,
            **data,
            "id": service_id,
            "updated_at": utc_now(),
        }
        self._db[service_id] = updated
        return updated

    def delete(self, service_id: str) -> bool:
        if service_id in self._db:
            del self._db[service_id]
            return True
        return False

# Single global instance of repository
repository = ActiveServiceRepository()
