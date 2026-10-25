"""Reject uninspectable documents before model work, in bounded disposable processes."""

import io
import json
import os
import subprocess
import signal
import sys
import threading
from contextlib import suppress
from pathlib import Path

MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 12_000_000
MAX_PAGES = 20
MEMORY_BYTES = 256 * 1024 * 1024
WORKER_SECONDS = 3
_slots = threading.BoundedSemaphore(2)
REASONS = {"blank", "invalid", "encrypted", "oversized", "complex", "unavailable"}


def _windows_job(pid):
    """Attach before writing input; the worker cannot decode untrusted bytes before this gate."""
    import ctypes
    from ctypes import wintypes

    class Basic(ctypes.Structure):
        _fields_ = [
            ("process_time", ctypes.c_longlong),
            ("job_time", ctypes.c_longlong),
            ("flags", wintypes.DWORD),
            ("min_working_set", ctypes.c_size_t),
            ("max_working_set", ctypes.c_size_t),
            ("active_processes", wintypes.DWORD),
            ("affinity", ctypes.c_size_t),
            ("priority", wintypes.DWORD),
            ("scheduling", wintypes.DWORD),
        ]

    class IO(ctypes.Structure):
        _fields_ = [
            (name, ctypes.c_ulonglong)
            for name in ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")
        ]

    class Extended(ctypes.Structure):
        _fields_ = [
            ("basic", Basic),
            ("io", IO),
            ("process_memory", ctypes.c_size_t),
            ("job_memory", ctypes.c_size_t),
            ("peak_process_memory", ctypes.c_size_t),
            ("peak_job_memory", ctypes.c_size_t),
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise OSError("Could not bound document worker")
    process = None
    try:
        limits = Extended()
        limits.basic.flags = 0x100 | 0x2000  # PROCESS_MEMORY and KILL_ON_JOB_CLOSE
        limits.process_memory = MEMORY_BYTES
        if not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            raise OSError("Could not limit document worker")
        process = kernel.OpenProcess(0x0100 | 0x0001, False, pid)  # SET_QUOTA and TERMINATE
        if not process or not kernel.AssignProcessToJobObject(job, process):
            raise OSError("Could not isolate document worker")
    except Exception:
        kernel.CloseHandle(job)
        raise
    finally:
        if process:
            kernel.CloseHandle(process)
    return lambda: kernel.CloseHandle(job)


def check_document(raw, mime_type):
    """None means content exists, not that it is a health report or clinically accurate."""
    if mime_type not in ("application/pdf", "image/png", "image/jpeg") or not raw:
        return "invalid"
    if len(raw) > MAX_BYTES:
        return "oversized"
    if not _slots.acquire(blocking=False):
        return "busy"
    process = None
    close_job = None
    try:
        # No provider, account or database credentials are inherited by the parser.
        environment = {
            key: value
            for key, value in os.environ.items()
            if key.upper()
            in {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"}
        }
        environment["PYTHONUTF8"] = "1"
        process = subprocess.Popen(
            [sys.executable, "-m", "services.documents", "--worker", mime_type],
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            start_new_session=os.name != "nt",
        )
        if os.name == "nt":
            close_job = _windows_job(process.pid)
        output, _ = process.communicate(raw, timeout=WORKER_SECONDS)
        if process.returncode or len(output) > 1024:
            return "unavailable"
        result = json.loads(output)
        reason = result.get("reason") if isinstance(result, dict) else "unavailable"
        return reason if reason in REASONS else None if result == {"reason": None} else "unavailable"
    except subprocess.TimeoutExpired:
        return "complex"
    except Exception:
        return "unavailable"
    finally:
        try:
            if close_job:
                close_job()  # Kill the Windows process tree before draining inherited pipes.
            if process is not None:
                if process.poll() is None:
                    if os.name == "nt":
                        process.kill()
                    else:
                        with suppress(ProcessLookupError):
                            os.killpg(process.pid, signal.SIGKILL)
                process.communicate(timeout=1)
        except (OSError, subprocess.SubprocessError):
            if process is not None:
                with suppress(OSError):
                    process.kill()
        finally:
            if process is not None:
                for stream in (process.stdin, process.stdout):
                    if stream:
                        with suppress(OSError):
                            stream.close()
            _slots.release()


def _visible_image(image):
    from PIL import Image

    if image.width * image.height > MAX_PIXELS or getattr(image, "n_frames", 1) != 1:
        return "oversized"
    if image.width < 64 or image.height < 32 or image.width * image.height < 4096:
        return "blank"
    image.load()
    if image.mode in ("RGBA", "LA", "P") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", image.size, "white")
        background.alpha_composite(rgba)
        extrema = background.convert("RGB").getextrema()
    else:
        extrema = image.convert("RGB").getextrema()
    return "blank" if all(high - low <= 2 for low, high in extrema) else None


def _inspect(raw, mime_type):
    from PIL import Image
    import warnings

    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    if mime_type != "application/pdf":
        expected = "PNG" if mime_type == "image/png" else "JPEG"
        with Image.open(io.BytesIO(raw), formats=[expected]) as image:
            if image.width * image.height > MAX_PIXELS:
                return "oversized"
            image.verify()
        with Image.open(io.BytesIO(raw), formats=[expected]) as image:
            return _visible_image(image)
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw), strict=True)
    if reader.is_encrypted:
        return "encrypted"
    if not 0 < len(reader.pages) <= MAX_PAGES:
        return "oversized" if reader.pages else "blank"
    visible = False
    pixels = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        visible = visible or any(character.isalnum() for character in text)
        if len(text) > 200_000:
            return "oversized"
        for embedded in page.images:
            image = embedded.image
            pixels += image.width * image.height
            if pixels > 2 * MAX_PIXELS:
                return "oversized"
            reason = _visible_image(image)
            if reason == "oversized":
                return reason
            visible = visible or reason is None
    return None if visible else "blank"


def _worker(mime_type):
    if os.name != "nt":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_BYTES, MEMORY_BYTES))
        resource.setrlimit(resource.RLIMIT_CPU, (2, 3))
    raw = sys.stdin.buffer.read(MAX_BYTES + 1)
    try:
        reason = "oversized" if len(raw) > MAX_BYTES else _inspect(raw, mime_type)
    except MemoryError:
        reason = "complex"
    except ImportError:
        reason = "unavailable"
    except Exception as exc:
        reason = (
            "oversized" if type(exc).__name__ in ("DecompressionBombError", "DecompressionBombWarning") else "invalid"
        )
    print(json.dumps({"reason": reason}))


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "--worker":
        raise SystemExit(2)
    _worker(sys.argv[2])
