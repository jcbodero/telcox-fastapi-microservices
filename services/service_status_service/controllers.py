from typing import Any
from fastapi import APIRouter, HTTPException, status
from models import ActiveServicePayload, ActiveServiceResponse
from repository import repository

router = APIRouter(prefix="/service-status-service", tags=["active-services"])

@router.get("/active-services", response_model=list[ActiveServiceResponse])
def list_active_services() -> list[dict[str, Any]]:
    return repository.list_all()

@router.post("/active-services", response_model=ActiveServiceResponse, status_code=status.HTTP_201_CREATED)
def create_active_service(payload: ActiveServicePayload) -> dict[str, Any]:
    return repository.create(payload.data)

@router.get("/active-services/{active_service_id}", response_model=ActiveServiceResponse)
def get_active_service(active_service_id: str) -> dict[str, Any]:
    service = repository.get_by_id(active_service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Active service not found")
    return service

@router.put("/active-services/{active_service_id}", response_model=ActiveServiceResponse)
def replace_active_service(active_service_id: str, payload: ActiveServicePayload) -> dict[str, Any]:
    service = repository.update(active_service_id, payload.data)
    if not service:
        raise HTTPException(status_code=404, detail="Active service not found")
    return service

@router.patch("/active-services/{active_service_id}", response_model=ActiveServiceResponse)
def update_active_service(active_service_id: str, payload: ActiveServicePayload) -> dict[str, Any]:
    service = repository.patch(active_service_id, payload.data)
    if not service:
        raise HTTPException(status_code=404, detail="Active service not found")
    return service

@router.delete("/active-services/{active_service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_active_service(active_service_id: str) -> None:
    deleted = repository.delete(active_service_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Active service not found")
