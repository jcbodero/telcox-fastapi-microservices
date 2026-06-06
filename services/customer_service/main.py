import logging
import os
import inspect
import time
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


class CustomerPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class CustomerResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str


SENSITIVE_KEYS = {"password", "token", "access_token", "refresh_token", "authorization"}


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
    """Local audit manager for this microservice."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.audit_backend = os.environ.get("AUDIT_BACKEND", "memory").lower()
        self.postgres_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
        Path("logs").mkdir(exist_ok=True)
        self.logger = logging.getLogger("customer-service-audit")
        if not self.logger.handlers:
            handler = logging.FileHandler("logs/customer-service-audit.log")
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
            logging.warning("Customer audit persistence failed: %s", exc)


audit_manager = AuditManager()


def audit_action(action: str, resource_type: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            bound_arguments = inspect.signature(func).bind_partial(*args, **kwargs)
            bound_arguments.apply_defaults()
            resource_id = (
                bound_arguments.arguments.get("customer_id")
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


class CacheManager:
    """Local TTL cache for frequent customer queries."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._cache.get(key)
        if not entry:
            return None
        created_at = datetime.fromisoformat(entry["created_at"]).timestamp()
        if datetime.now(timezone.utc).timestamp() - created_at > entry["ttl_seconds"]:
            del self._cache[key]
            return None
        entry["hit_count"] += 1
        entry["last_accessed"] = utc_now()
        return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        now = utc_now()
        self._cache[key] = {
            "value": value,
            "ttl_seconds": ttl_seconds,
            "created_at": now,
            "last_accessed": now,
            "hit_count": 0,
        }

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)

    def cleanup_expired(self) -> int:
        before = len(self._cache)
        for key in list(self._cache.keys()):
            self.get(key)
        return before - len(self._cache)

    def stats(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc).timestamp()
        return {
            "total_entries": len(self._cache),
            "entries": [
                {
                    "key": key,
                    "hit_count": entry["hit_count"],
                    "ttl_remaining": max(0, int(entry["ttl_seconds"] - (now - datetime.fromisoformat(entry["created_at"]).timestamp()))),
                }
                for key, entry in self._cache.items()
            ],
        }


class PersistenceRepository:
    """Local repository pattern for customer persistence."""

    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self._store: dict[str, dict[str, Any]] = {}

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        record_id = data.get("id", str(uuid4()))
        now = utc_now()
        record = {"id": record_id, "created_at": data.get("created_at", now), "updated_at": data.get("updated_at", now), **data}
        self._store[record_id] = record
        return record

    def read(self, record_id: str) -> dict[str, Any] | None:
        return self._store.get(record_id)

    def read_all(self) -> list[dict[str, Any]]:
        return list(self._store.values())

    def update(self, record_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        if record_id not in self._store:
            return None
        self._store[record_id] = {**self._store[record_id], **data, "id": record_id, "updated_at": utc_now()}
        return self._store[record_id]

    def delete(self, record_id: str) -> bool:
        if record_id not in self._store:
            return False
        del self._store[record_id]
        return True

    def exists(self, record_id: str) -> bool:
        return record_id in self._store


class CachedRepository:
    """Cache-Aside wrapper for the local repository."""

    def __init__(self, repository: PersistenceRepository, cache_manager: CacheManager, ttl_seconds: int = 300):
        self.repository = repository
        self.cache = cache_manager
        self.ttl_seconds = ttl_seconds

    def _key(self, suffix: str) -> str:
        return f"{self.repository.collection_name}:{suffix}"

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        record = self.repository.create(data)
        self.cache.delete(self._key("list:all"))
        return record

    def read(self, record_id: str) -> dict[str, Any] | None:
        key = self._key(f"item:{record_id}")
        cached = self.cache.get(key)
        if cached is not None:
            return cached
        record = self.repository.read(record_id)
        if record is not None:
            self.cache.set(key, record, self.ttl_seconds)
        return record

    def read_all(self) -> list[dict[str, Any]]:
        key = self._key("list:all")
        cached = self.cache.get(key)
        if cached is not None:
            return cached
        records = self.repository.read_all()
        self.cache.set(key, records, self.ttl_seconds)
        return records

    def update(self, record_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        record = self.repository.update(record_id, data)
        self.cache.delete(self._key(f"item:{record_id}"))
        self.cache.delete(self._key("list:all"))
        return record

    def delete(self, record_id: str) -> bool:
        deleted = self.repository.delete(record_id)
        self.cache.delete(self._key(f"item:{record_id}"))
        self.cache.delete(self._key("list:all"))
        return deleted

    def exists(self, record_id: str) -> bool:
        return self.repository.exists(record_id)


app = FastAPI(
    title="TelcoX Customer Service",
    description="CRUD basico de clientes TelcoX. Simula la consulta de datos del BSS.",
    version="1.0.0",
    docs_url="/customer-service/docs",
    openapi_url="/customer-service/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_NAME = "customer-service"
customer_repository = PersistenceRepository("customers")
cache_manager = CacheManager()
cached_customer_repository = CachedRepository(customer_repository, cache_manager, ttl_seconds=300)


@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", os.environ.get("SERVICE_PORT", "8001"))
    logging.info("Customer Service starting on port %s", port)


def build_customer(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "id": data.get("id", str(uuid4())),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


seed_customers: list[dict[str, Any]] = [
    build_customer(
        {
            "id": "cus-1001",
            "document_id": "0912345678",
            "full_name": "Ana Torres",
            "email": "ana.torres@example.com",
            "phone": "+593987654321",
            "status": "active",
            "segment": "postpaid",
            "identity_status": "verified",
            "auth_methods": ["password", "passkey", "device_biometric"],
            "identity_provider": "keycloak",
        }
    )
]

for customer in seed_customers:
    cached_customer_repository.create(customer)


@app.get("/customer-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Customer Service"}


@app.get("/customer-service/audit", tags=["audit"])
def get_audit_trail() -> list[dict[str, Any]]:
    return audit_manager.events


@app.get("/customer-service/cache/stats", tags=["cache"])
def get_cache_stats() -> dict[str, Any]:
    return cache_manager.stats()


@app.post("/customer-service/cache/cleanup", tags=["cache"])
def cleanup_cache() -> dict[str, str]:
    removed = cache_manager.cleanup_expired()
    return {"message": f"Removed {removed} expired entries"}


@app.get("/customer-service/customers", response_model=list[CustomerResponse], tags=["customers"])
@audit_action("READ", "CUSTOMERS_LIST")
def list_customers() -> list[dict[str, Any]]:
    return cached_customer_repository.read_all()


@app.post("/customer-service/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED, tags=["customers"])
@audit_action("CREATE", "CUSTOMER")
def create_customer(payload: CustomerPayload) -> dict[str, Any]:
    customer = build_customer(payload.data)
    return cached_customer_repository.create(customer)


@app.get("/customer-service/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
@audit_action("READ", "CUSTOMER")
def get_customer(customer_id: str) -> dict[str, Any]:
    customer = cached_customer_repository.read(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@app.put("/customer-service/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
@audit_action("UPDATE", "CUSTOMER")
def replace_customer(customer_id: str, payload: CustomerPayload) -> dict[str, Any]:
    existing = cached_customer_repository.read(customer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer = build_customer(
        {
            **payload.data,
            "id": customer_id,
            "created_at": existing["created_at"],
            "updated_at": utc_now(),
        }
    )
    return cached_customer_repository.update(customer_id, customer)


@app.patch("/customer-service/customers/{customer_id}", response_model=CustomerResponse, tags=["customers"])
@audit_action("UPDATE", "CUSTOMER")
def update_customer(customer_id: str, payload: CustomerPayload) -> dict[str, Any]:
    if not cached_customer_repository.exists(customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    
    updated = cached_customer_repository.update(
        customer_id,
        {**payload.data, "id": customer_id, "updated_at": utc_now()},
    )
    return updated


@app.delete("/customer-service/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["customers"])
@audit_action("DELETE", "CUSTOMER")
def delete_customer(customer_id: str) -> None:
    if not cached_customer_repository.exists(customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")

    cached_customer_repository.delete(customer_id)
