"""Real bounded parser tests; every document is generated synthetically in memory."""

import io
import json
import os
import struct
import subprocess
import zlib
from unittest.mock import Mock, patch
import pytest
from PIL import Image, ImageDraw
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from services import documents
from services.assistant import analyze_report, chat_reply


def image_bytes(*, blank=False, transparent=False, kind="PNG"):
    image = Image.new("RGBA" if transparent else "RGB", (240, 100), (0, 0, 0, 0) if transparent else "white")
    if not blank:
        ImageDraw.Draw(image).text((10, 25), "Synthetic report 13.8", fill=(0, 0, 0, 0) if transparent else "black")
    output = io.BytesIO()
    image.save(output, format=kind)
    return output.getvalue()


def pdf_bytes(*, blank=False, encrypted=False, pages=1):
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=240, height=100)
        if not blank:
            font = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                }
            )
            page[NameObject("/Resources")] = DictionaryObject(
                {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
            )
            stream = DecodedStreamObject()
            stream.set_data(b"BT /F1 12 Tf 10 50 Td (Synthetic report: hemoglobin 13.8) Tj ET")
            page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("synthetic-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize("kind,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg")])
def test_real_image_content_is_accepted_in_bounded_worker(kind, mime):
    assert documents.check_document(image_bytes(kind=kind), mime) is None


@pytest.mark.parametrize(
    "raw,mime,reason",
    [
        (lambda: image_bytes(blank=True), "image/png", "blank"),
        (lambda: image_bytes(transparent=True), "image/png", "blank"),
        (lambda: pdf_bytes(blank=True), "application/pdf", "blank"),
        (lambda: pdf_bytes(encrypted=True), "application/pdf", "encrypted"),
        (lambda: pdf_bytes(pages=21), "application/pdf", "oversized"),
        (lambda: b"%PDF-truncated", "application/pdf", "invalid"),
        (lambda: b"\x89PNG\r\n\x1a\ntruncated", "image/png", "invalid"),
    ],
)
def test_blank_corrupt_encrypted_and_oversized_documents_are_rejected(raw, mime, reason):
    assert documents.check_document(raw(), mime) == reason


def test_pdf_text_and_scanned_report_images_are_accepted():
    assert documents.check_document(pdf_bytes(), "application/pdf") is None
    image = Image.open(io.BytesIO(image_bytes())).convert("RGB")
    output = io.BytesIO()
    image.save(output, format="PDF")
    assert documents.check_document(output.getvalue(), "application/pdf") is None


def test_blank_scan_embedded_in_pdf_is_rejected():
    image = Image.open(io.BytesIO(image_bytes(blank=True))).convert("RGB")
    output = io.BytesIO()
    image.save(output, format="PDF")
    assert documents.check_document(output.getvalue(), "application/pdf") == "blank"


def test_image_dimensions_are_checked_before_allocating_full_pixel_buffer():
    def chunk(name, value):
        return struct.pack(">I", len(value)) + name + value + struct.pack(">I", zlib.crc32(name + value) & 0xFFFFFFFF)

    raw = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 5000, 5000, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b""))
        + chunk(b"IEND", b"")
    )
    assert documents.check_document(raw, "image/png") == "oversized"


def test_validation_capacity_is_bounded_and_recovers():
    for _ in range(2):
        assert documents._slots.acquire(blocking=False)
    try:
        assert documents.check_document(image_bytes(), "image/png") == "busy"
    finally:
        for _ in range(2):
            documents._slots.release()
    assert documents.check_document(image_bytes(), "image/png") is None


def test_worker_timeout_kills_process_and_does_not_forward_credentials():
    process = Mock()
    process.communicate.side_effect = [subprocess.TimeoutExpired("worker", 3), (b"", None)]
    process.poll.return_value = None
    with patch.dict(
        "os.environ",
        {"GEMINI_API_KEY": "not-forwarded", "AI_INTERNAL_SECRET": "not-forwarded", "DATABASE_URL": "not-forwarded"},
    ):
        with (
            patch("services.documents.subprocess.Popen", return_value=process) as spawn,
            patch("services.documents._windows_job", return_value=lambda: None),
            patch("services.documents.os.killpg", create=True) as kill_group,
        ):
            assert documents.check_document(b"%PDF-synthetic", "application/pdf") == "complex"
    if os.name == "nt":
        process.kill.assert_called_once()
    else:
        kill_group.assert_called_once()
    environment = spawn.call_args.kwargs["env"]
    assert not set(environment) & {"GEMINI_API_KEY", "AI_INTERNAL_SECRET", "DATABASE_URL"}


@pytest.mark.parametrize("cleanup_error", [OSError("unavailable"), subprocess.TimeoutExpired("worker", 1)])
def test_cleanup_failure_does_not_leak_validation_capacity(cleanup_error):
    process = Mock()
    process.communicate.side_effect = [subprocess.TimeoutExpired("worker", 3), cleanup_error]
    process.poll.return_value = None
    with (
        patch("services.documents.subprocess.Popen", return_value=process),
        patch("services.documents._windows_job", return_value=lambda: None),
        patch("services.documents.os.killpg", create=True),
    ):
        assert documents.check_document(b"%PDF-synthetic", "application/pdf") == "complex"
    assert documents._slots.acquire(blocking=False)
    assert documents._slots.acquire(blocking=False)
    documents._slots.release()
    documents._slots.release()


@pytest.mark.parametrize("issue", ["blank", "invalid", "encrypted", "oversized", "complex"])
def test_rejected_document_never_reaches_model_and_has_no_findings(issue):
    with patch("services.assistant.check_document", return_value=issue), patch("services.assistant.generate") as model:
        result = analyze_report(b"synthetic", "image/png")
    model.assert_not_called()
    assert result["source"] == "rules" and result["document_status"] == "unreadable"
    assert result["discussion_points"] == []


@pytest.mark.parametrize("issue", ["busy", "unavailable"])
def test_validation_failure_is_not_misreported_as_an_unreadable_file(issue):
    with patch("services.assistant.check_document", return_value=issue), patch("services.assistant.generate") as model:
        result = analyze_report(b"synthetic", "image/png")
    model.assert_not_called()
    assert result["source"] == "fallback" and result["document_status"] == "not_reviewed"


def test_critical_simulated_values_never_become_model_generated_symptom_claims():
    context = {
        "fresh": True,
        "vitals": {"heart_rate": 165, "spo2": 85, "temperature": 40, "ecg_status": "Normal", "source": "Simulator"},
    }
    with patch("services.assistant.generate") as model:
        result = chat_reply("Can I go for a run?", context=context)
    model.assert_not_called()
    assert result["source"] == "rules" and "cannot establish your physical condition" in result["reply"]
    assert "these readings indicate symptoms" not in json.dumps(result)
