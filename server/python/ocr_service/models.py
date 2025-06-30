from pydantic import BaseModel, Field
from typing import Optional

class OCRResult(BaseModel):
    raw_text: str
    document_type: Optional[str] = Field(default="Unknown")
    lc_number: Optional[str] = None
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[str] = None
