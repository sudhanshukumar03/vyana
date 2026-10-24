"""Bounded contracts used on every model and HTTP boundary."""
import base64
import binascii
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

MAX_REPORT_BYTES = 10 * 1024 * 1024
DISCLAIMER = "AI wellness guidance only; not a substitute for professional medical care."


class Insight(BaseModel):
    type: Literal["info", "warning", "success", "critical"]
    title: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=2000)


class InsightResponse(BaseModel):
    insights: list[Insight] = Field(min_length=1, max_length=8)
    offline: bool = False


class HealthData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    owner_id: str = Field(min_length=1, max_length=64)
    vitals: dict = Field(default_factory=dict)
    activity: dict = Field(default_factory=dict)
    alerts: list = Field(default_factory=list, max_length=100)
    wellness_score: int | None = Field(default=None, ge=0, le=100)
    profile: dict = Field(default_factory=dict)
    historical_vitals: dict = Field(default_factory=dict)
    bmi: dict | None = None
    fresh: bool = False


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(HealthData):
    message: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = Field(default_factory=list, max_length=16)

    @field_validator("message")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("message is required")
        return value.strip()


class ChatResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=16000)
    disclaimer: str = DISCLAIMER
    offline: bool


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    owner_id: str = Field(min_length=1, max_length=64)
    data_base64: str = Field(min_length=1, max_length=13981016)
    mime_type: Literal["application/pdf", "image/png", "image/jpeg"]
    filename: str = Field(default="", max_length=255)

    def decode(self):
        try:
            raw = base64.b64decode(self.data_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Invalid base64 report") from exc
        if len(raw) > MAX_REPORT_BYTES:
            raise OverflowError("File too large (maximum 10 MiB)")
        valid = raw.startswith(b"%PDF-") if self.mime_type == "application/pdf" else (
            raw.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10])) if self.mime_type == "image/png" else raw.startswith(b"\xff\xd8\xff")
        )
        if not valid:
            raise ValueError("File content does not match its type")
        return raw


class ReportResponse(BaseModel):
    summary: str = Field(min_length=1, max_length=16000)
    discussion_points: list[str] = Field(default_factory=list, max_length=20)
    disclaimer: str = DISCLAIMER
    offline: bool

    @field_validator("discussion_points")
    @classmethod
    def bounded_points(cls, values):
        if any(len(value) > 1000 for value in values):
            raise ValueError("Discussion point too long")
        return values
