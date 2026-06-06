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

class ProvisionPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class ProvisionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    reference_id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TelcoX External — Network OSS Mock",
    description=(
        "Simula el sistema OSS/NMS (Operations Support System / Network Management System) "
        "de la red de TelcoX. Recibe órdenes de provisión desde el BSS y devuelve "
        "un `network_reference_id` con el estado de la activación en red."
    ),
    version="1.0.0",
    docs_url="/network-oss/docs",
    openapi_url="/network-oss/openapi.json",
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

network_orders: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_latency() -> None:
    """Simulate realistic OSS/NMS processing latency (80–500 ms)."""
    time.sleep(random.uniform(0.08, 0.50))


def assign_network_resources(operation: str, product_id: str) -> dict[str, Any]:
    """Simulate network resource allocation based on product type."""
    resources: dict[str, Any] = {}
    if "5g" in product_id.lower() or "mobile" in product_id.lower():
        resources = {
            "radio_access_technology": "5G NR",
            "cell_id": f"CELL-{random.randint(1000, 9999)}",
            "imsi_assigned": f"74002{random.randint(10000000000, 99999999999)}",
            "apn": "telcox.5g.ec",
            "qos_profile": "QCI-7",
        }
    elif "fibra" in product_id.lower() or "broadband" in product_id.lower():
        resources = {
            "access_technology": "GPON",
            "olt_port": f"OLT-{random.randint(1, 48)}/0/{random.randint(1, 64)}",
            "vlan_id": random.randint(100, 4090),
            "downstream_mbps": 200,
            "upstream_mbps": 100,
        }
    elif "extra" in product_id.lower():
        resources = {
            "data_bundle_added_gb": 10,
            "bundle_reference": f"BND-{str(uuid4())[:8].upper()}",
        }
    elif "roaming" in product_id.lower():
        resources = {
            "roaming_profile": "Americas-Zone-A",
            "partner_network": "AT&T",
            "roaming_apn": "telcox.roaming.ec",
        }
    elif "streaming" in product_id.lower():
        resources = {
            "content_partner": "Netflix+Spotify",
            "zero_rating_enabled": True,
        }
    return resources


def build_network_order(data: dict[str, Any]) -> dict[str, Any]:
    now = utc_now()
    return {
        "reference_id": data.get("reference_id", f"netref-{str(uuid4())[:12]}"),
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
        **data,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8012")
    logging.info("External Network OSS Mock starting on port %s", port)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/network-oss/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "External Network OSS Mock"}


@app.get("/network-oss/network-status", tags=["network"])
def network_status() -> dict[str, Any]:
    """Estado general de la red TelcoX (simulado)."""
    return {
        "timestamp": utc_now(),
        "overall_status": "operational",
        "regions": {
            "quito": {"status": "operational", "5g_coverage_pct": 92, "fiber_nodes": 1240},
            "guayaquil": {"status": "operational", "5g_coverage_pct": 88, "fiber_nodes": 980},
            "cuenca": {"status": "degraded", "5g_coverage_pct": 71, "fiber_nodes": 340, "incident": "INC-2026-0042"},
        },
        "active_incidents": 1,
        "active_subscribers": random.randint(890000, 910000),
    }


@app.post(
    "/network-oss/provision",
    response_model=ProvisionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["provisioning"],
)
def provision(payload: ProvisionPayload) -> dict[str, Any]:
    """
    Recibe una orden de provisión desde el BSS y la ejecuta en red.

    Campos esperados en `data`:
    - `customer_id` (str, requerido)
    - `product_id` (str, requerido)
    - `operation` ("activate" | "deactivate" | "suspend" | "upgrade" | "add_addon", requerido)
    - `bss_order_id` (str, opcional — ID de la orden en el BSS para trazabilidad)
    - `mode` ("success" | "fail", default "success")
    """
    simulate_latency()
    data = payload.data
    customer_id = data.get("customer_id")
    product_id = data.get("product_id")
    operation = data.get("operation", "activate")

    if not customer_id:
        raise HTTPException(status_code=400, detail="Missing required field: customer_id")
    if not product_id:
        raise HTTPException(status_code=400, detail="Missing required field: product_id")

    mode = data.get("mode", "success")
    if mode == "fail":
        raise HTTPException(
            status_code=503,
            detail={
                "error": "network_provisioning_failed",
                "reason": "No available radio resources in target cell",
                "retry_after_seconds": 60,
            },
        )

    network_resources = assign_network_resources(operation, product_id)
    net_status_map = {
        "activate": "active",
        "deactivate": "deactivated",
        "suspend": "suspended",
        "upgrade": "active",
        "add_addon": "active",
    }

    order = build_network_order({
        "customer_id": customer_id,
        "product_id": product_id,
        "operation": operation,
        "bss_order_id": data.get("bss_order_id"),
        "status": net_status_map.get(operation, "active"),
        "network_node": f"NDE-{random.randint(100, 999)}",
        "provisioned_at": utc_now(),
        **network_resources,
    })
    network_orders[order["reference_id"]] = order
    return order


@app.get(
    "/network-oss/provision/{reference_id}",
    response_model=ProvisionResponse,
    tags=["provisioning"],
)
def get_provision_order(reference_id: str) -> dict[str, Any]:
    """Consulta el estado de una orden de provisión en la red."""
    order = network_orders.get(reference_id)
    if not order:
        raise HTTPException(status_code=404, detail="Network provisioning order not found")
    return order


@app.get("/network-oss/provision", tags=["provisioning"])
def list_provision_orders() -> list[dict[str, Any]]:
    """Lista todas las órdenes de provisión registradas en esta sesión."""
    return list(network_orders.values())
