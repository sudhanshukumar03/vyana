"""Narrow deterministic limits in addition to model instructions.

These rules catch known prohibited requests/claims. They are not a clinical
classifier or a substitute for live adversarial evaluation.
"""
import re
import unicodedata


def restricted_request(message):
    text = unicodedata.normalize("NFKC", message)
    if re.search(r"\b(?:diagnos\w*|prescrib\w*|dosages?|how many pills|how much medication)\b", text, re.I):
        return "A qualified clinician should assess diagnosis and medication decisions. I can help you prepare questions for that conversation."
    if re.search(r"\b(?:call|contact|dispatch)\b.{0,40}\b(?:ambulance|emergency services)\b", text, re.I):
        return "Use the Emergency page to call a listed contact or log an in-app SOS. This app cannot dispatch services."
    if re.search(r"\b(?:another|other)\s+(?:patient|user|person)(?:'s)?\s+(?:data|records|profile|readings)\b", text, re.I):
        return "Only information from your signed-in account is available."
    return None


def enforce_output(text):
    normalized = unicodedata.normalize("NFKC", text).replace("\\n", " ")
    prohibited = (
        r"\b(?:take|increase|decrease|start|stop|prescribe|recommend|switch|use)\b.{0,80}\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|tablets?|pills?)\b",
        r"\b(?:you (?:are diagnosed with|have (?:been diagnosed with|(?:a |an )?(?:(?:serious|medical|chronic|acute) )?(?:condition|disease|disorder|infection)|diabetes|hypertension|arrhythmia))|this (?:confirms|diagnoses)|I (?:diagnose|can confirm)|your diagnosis is)\b",
        r"\b(?:I (?:have )?(?:called|contacted|dispatched).{0,30}(?:ambulance|emergency services)|(?:ambulance|emergency services) (?:has|have|was|were) (?:been )?(?:called|contacted|dispatched))\b",
        r"\b(?:you are (?:perfectly )?healthy|nothing to worry about|no need (?:for|to see).{0,30}(?:doctor|clinician|medical))\b",
    )
    if any(re.search(pattern, normalized, re.I | re.S) for pattern in prohibited):
        raise ValueError("Model output exceeds the prototype wellness scope")
    return text
