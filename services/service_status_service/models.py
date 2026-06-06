from typing import Any
from pydantic import BaseModel, ConfigDict, Field

class ActiveServicePayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)

class ActiveServiceResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    created_at: str
    updated_at: str
