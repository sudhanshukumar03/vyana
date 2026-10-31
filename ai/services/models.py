"""Bounded contracts used on every model and HTTP boundary."""
import base64
import binascii
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

MAX_REPORT_BYTES = 10 * 1024 * 1024
DISCLAIMER = "AI wellness guidance only; not a substitute for professional medical care."

FailureReason = Literal["not_configured", "configuration", "authentication", "permission", "quota", "timeout",
                        "network", "model_unavailable", "busy", "invalid_response", "safety", "unavailable"]


class AnswerSection(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)
    items: list[str] = Field(min_length=1, max_length=6)

    @field_validator("items")
    @classmethod
    def bounded_items(cls, values):
        if any(not value.strip() or len(value) > 1000 for value in values):
            raise ValueError("Invalid answer item")
        return [value.strip() for value in values]


class ChatAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    answer: str = Field(min_length=1, max_length=4000, description="A direct, professional answer in plain language. Lead with the main point, not a disclaimer.")
    sections: list[AnswerSection] = Field(default_factory=list, max_length=4, description="Only useful supporting sections, such as What the data shows, What this means, or Next steps. Omit for simple answers.")


class ResponseMetadata(BaseModel):
    source: Literal["gemini", "rules", "fallback"] = "fallback"
    reason: FailureReason | None = None
    retry_after_seconds: int | None = Field(default=None, ge=1, le=300)


class Insight(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    type: Literal["info", "warning", "success", "critical"]
    title: str = Field(min_length=1, max_length=120)
    detail: str = Field(min_length=1, max_length=2000)


class InsightAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    insights: list[Insight] = Field(min_length=1, max_length=8)


class InsightResponse(InsightAnswer):
    offline: bool = False


class ReviewBodyContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bmi: float | None = None
    maintenance_kcal: int | None = Field(default=None, gt=0)
    energy_status: Literal["ready", "profile_needed", "age_restricted", "review_required"]
    model: Literal["DRI-EER-2023"]


class ReviewFactContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(max_length=50)
    title: str = Field(max_length=120)
    detail: str = Field(max_length=1000)


class ReviewPeriodContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class HealthReviewContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facts: list[ReviewFactContext] = Field(default_factory=list, max_length=3)
    period: ReviewPeriodContext
    body: ReviewBodyContext


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
    health_review: HealthReviewContext | None = None


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


class ChatResponse(ResponseMetadata):
    reply: str = Field(min_length=1, max_length=16000)
    disclaimer: str = DISCLAIMER
    offline: bool
    sections: list[AnswerSection] = Field(default_factory=list, max_length=6)


class ReportRequest(HealthData):
    data_base64: str = Field(min_length=1, max_length=13981016)
    mime_type: Literal["application/pdf", "image/png", "image/jpeg"]
    filename: str = Field(default="", max_length=255)

    def decode(self):
        try:
            raw = base64.b64decode(self.data_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Invalid base64 report") from exc
        if base64.b64encode(raw).decode() != self.data_base64:
            raise ValueError("Invalid base64 report")
        if len(raw) > MAX_REPORT_BYTES:
            raise OverflowError("File too large (maximum 10 MiB)")
        valid = raw.startswith(b"%PDF-") if self.mime_type == "application/pdf" else (
            raw.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10])) if self.mime_type == "image/png" else raw.startswith(b"\xff\xd8\xff")
        )
        if not valid:
            raise ValueError("File content does not match its type")
        return raw


class ReportAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    summary: str = Field(min_length=1, max_length=16000)
    sections: list[AnswerSection] = Field(default_factory=list, max_length=4)
    document_status: Literal["readable", "unreadable", "not_health_report"] = "readable"
    discussion_points: list[str] = Field(default_factory=list, max_length=20, description="Questions the user can ask their clinician, written from the user's perspective. For example: Do I need follow-up testing? Do not ask the user questions or offer AI help.")

    @field_validator("discussion_points")
    @classmethod
    def bounded_points(cls, values):
        if any(not value.strip() or len(value) > 1000 for value in values):
            raise ValueError("Discussion point too long")
        return values


class ReportResponse(ReportAnswer, ResponseMetadata):
    document_status: Literal["readable", "unreadable", "not_health_report", "not_reviewed"] = "not_reviewed"
    sections: list[AnswerSection] = Field(default_factory=list, max_length=6)
    disclaimer: str = DISCLAIMER
    offline: bool
