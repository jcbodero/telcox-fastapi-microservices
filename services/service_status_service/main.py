import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .controllers import router

app = FastAPI(
    title="TelcoX Service Status Service",
    description="CRUD estructurado en MVC para servicios activos, uso de datos, saldo y estado operativo.",
    version="1.0.0",
    docs_url="/service-status-service/docs",
    openapi_url="/service-status-service/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    port = os.environ.get("PORT", "8008")
    logging.info(f"Service Status Service starting on port {port}")

# Health endpoint can remain in main.py or controllers
@app.get("/service-status-service/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "Service Status Service (MVC)"}

app.include_router(router)
