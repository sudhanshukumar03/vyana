"""Operator-only Gemini probe. Outputs allowlisted metadata, never credentials or response bodies."""
import argparse
import json
import os
import re
from itertools import islice
from pathlib import Path
from dotenv import dotenv_values
from services.gemini import provider_client, provider_error, settings, generate
from services.models import ChatAnswer
from services.gemini import json_object
from services.assistant import validate_text

NEXT_STEPS = {
    "not_configured": "Set GEMINI_API_KEY privately in the selected environment file.",
    "configuration": "Check key copy/quoting, model ID and supported generation parameters.",
    "authentication": "Verify the key in AI Studio, its project and bound service account. Check for a disabled, revoked or incorrectly copied key; replace locally if needed.",
    "permission": "Check Gemini API enablement, key restrictions, service account access and account/region eligibility in the provider console.",
    "quota": "Check API billing, credits and quota in the provider console; wait before retrying.",
    "model_unavailable": "Choose an available Gemini model supporting generateContent, JSON schema and PDF/image input; update GEMINI_MODEL locally.",
    "timeout": "Check connectivity and retry later; generation has a 30-second timeout.",
    "network": "Check DNS, HTTPS access and proxy configuration, then retry.",
    "unavailable": "Retry later and check the provider service status.",
    "invalid_response": "Check model compatibility and output validation before enabling live use.",
    "safety": "The synthetic response was blocked or failed the wellness scope checks; review before enabling live use.",
}


def probe(generate_sample=False):
    stage = "configuration"
    result = {"authentication_verified": False, "model_access_verified": False, "generation_verified": False}
    try:
        key, model = settings()
        result["model"] = model
        stage = "model_access"
        with provider_client(key) as client:
            info = client.models.get(model=model)
        result.update(authentication_verified=True, model_access_verified=True)
        actions = getattr(info, "supported_actions", None)
        if actions and "generateContent" not in actions:
            result.update(reason="model_unavailable", stage=stage, next_step=NEXT_STEPS["model_unavailable"])
            return result
        if generate_sample:
            stage = "generation"
            text = generate("Explain in one sentence what a step count measures. No personal data is provided.", schema=ChatAnswer)
            answer = ChatAnswer.model_validate(json_object(text))
            validate_text(answer)
            result["generation_verified"] = True
        result.update(reason=None, stage="complete", next_step="Recreate the AI container after environment changes. Then verify chat and a synthetic report through the signed-in app.")
    except Exception as exc:
        diagnostic = provider_error(exc)
        if stage == "generation" and diagnostic["reason"] == "unavailable" and isinstance(exc, ValueError):
            diagnostic["reason"] = "invalid_response"
        result.update(diagnostic, stage=stage, next_step=NEXT_STEPS.get(diagnostic["reason"], NEXT_STEPS["unavailable"]))
    return result


def available_models():
    try:
        key, _model = settings()
        with provider_client(key) as client:
            models = [item.name for item in islice(client.models.list(config={"page_size": 100}), 100)
                if item.name and re.fullmatch(r"models/[A-Za-z0-9._-]{1,100}", item.name)
                and "generateContent" in (item.supported_actions or [])]
        return {"available_generation_models": models, "reason": None}
    except Exception as exc:
        result = provider_error(exc)
        result["next_step"] = NEXT_STEPS.get(result["reason"], NEXT_STEPS["unavailable"])
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--env-file", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    source.add_argument("--environment", action="store_true", help="Use only the current process environment, for example inside the AI container.")
    parser.add_argument("--generate", action="store_true", help="Also run one short synthetic generation (may consume API quota).")
    parser.add_argument("--list-models", action="store_true", help="List at most 100 model names supporting generateContent; sends no health data.")
    args = parser.parse_args()
    if not args.environment and not args.env_file.is_file():
        print(json.dumps({"reason": "configuration", "next_step": "The selected environment file does not exist."}))
        return 1
    # Explicit file selection is authoritative, matching Compose's source of truth.
    if not args.environment:
        values = dotenv_values(args.env_file, interpolate=False)
        for name in ("GEMINI_API_KEY", "GEMINI_MODEL"):
            if name in values:
                os.environ[name] = values[name] or ""
    result = available_models() if args.list_models else probe(args.generate)
    print(json.dumps(result, indent=2))
    return 0 if result.get("reason") is None else 1


if __name__ == "__main__":
    raise SystemExit(main())
