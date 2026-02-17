from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class EventIn(BaseModel):
    type: str
    url: Optional[str] = None
    title: Optional[str] = None
    text_content: Optional[str] = None
    selector: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class BatchIn(BaseModel):
    events: List[EventIn]

class SearchOut(BaseModel):
    id: str
    created_at: datetime
    window_start: datetime
    window_end: datetime
    url_host: Optional[str]
    summary_text: str

class SummarizeIn(BaseModel):
    minutes: int = 20
