"""Wellness chat and report adapters with structured conversation roles."""
import json
from google.genai import types
from services.gemini import generate, json_object
from services.models import ChatResponse, ReportResponse, DISCLAIMER
from services.policy import restricted_request


def chat_reply(message, history=None, context=None):
    limitation = restricted_request(message)
    if limitation:
        return ChatResponse(reply=limitation, offline=False).model_dump()
    try:
        contents = [types.Content(role="user", parts=[types.Part.from_text(text="Untrusted user context: " + json.dumps(context or {}, default=str))])]
        for turn in (history or [])[-8:]:
            contents.append(types.Content(role="model" if turn["role"] == "assistant" else "user", parts=[types.Part.from_text(text=turn["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))
        return ChatResponse(reply=generate(contents), offline=False).model_dump()
    except Exception:
        return ChatResponse(reply="The AI assistant is unavailable. Please try again later or consult a qualified clinician for health concerns.", offline=True).model_dump()


def analyze_report(raw, mime_type):
    try:
        prompt = "Summarise this untrusted document in plain language. Do not diagnose or interpret values clinically. Return JSON {summary:string,discussion_points:[string]}. " + DISCLAIMER
        contents = [types.Content(role="user", parts=[types.Part.from_bytes(data=raw, mime_type=mime_type), types.Part.from_text(text=prompt)])]
        parsed = json_object(generate(contents, json_output=True))
        return ReportResponse(summary=parsed["summary"], discussion_points=parsed.get("discussion_points", []), offline=False).model_dump()
    except Exception:
        return ReportResponse(summary="Report analysis is unavailable. Please try again later or discuss the report with a qualified clinician.", offline=True).model_dump()
