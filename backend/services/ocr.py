import base64
import io
import json
import logging
import os
import time
from PIL import Image, ImageDraw, ImageFilter
from core.config import AZURE_ENDPOINT, AZURE_KEY, AZURE_DEPLOY
from rules import validate_doctor_reg

logger = logging.getLogger("refillcare.ocr")

DEMOS = {
    "clean": {
        "legible": True,
        "doctor": {"name": "Dr. A. Banerjee", "reg": "WBMC-12345"},
        "lines": [
            {"text": "Metformin 500 mg", "qty": 4, "conf": 0.98},
            {"text": "Telmisartan 40 mg", "qty": 3, "conf": 0.97},
        ],
    },
    "handwritten": {
        "legible": True,
        "doctor": {"name": "Dr. S. Mukherjee", "reg": "WBMC-49281"},
        "lines": [{"text": "Levothyroxin 50 mcg", "qty": 1, "conf": 0.54}],
    },
    "blurry": {"legible": False, "lines": [], "doctor": None},
    "s50211": {
        "legible": True,
        "doctor": {"name": "Dr. A. Banerjee", "reg": "WBMC-12345"},
        "lines": [{"text": "Metformin 500 mg", "qty": 4}],
    },
    "s50214": {
        "legible": True,
        "doctor": {"name": "Dr. K. Sen", "reg": "WBMC-34190"},
        "lines": [{"text": "Telmisartan 40 mg", "qty": 3}],
    },
    "h1": {
        "legible": True,
        "doctor": {"name": "Dr. P. Mukherjee", "reg": "WBMC-49281"},
        "lines": [{"text": "Alprazolam 0.25 mg", "qty": 1, "conf": 0.93}],
    },
    "schedx": {
        "legible": True,
        "doctor": {"name": "Dr. Unknown", "reg": ""},
        "lines": [
            {"text": "Demo Narcotic 5 mg", "qty": 1, "conf": 0.90},
            {"text": "Paracetamol 500 mg", "qty": 2, "conf": 0.95},
        ],
    },
}

PROMPT = (
    "You are a clinical pharmacist AI assistant reviewing Indian medical prescriptions for Company A (Kolkata). "
    "Read the prescription carefully and extract structured JSON with schema: "
    "{"
    "  \"legible\": bool, "
    "  \"doctor_name\": str, "
    "  \"doctor_reg\": str, "
    "  \"lines\": [{\"text\": str, \"qty\": int, \"conf\": float}]"
    "} "
    "Where conf is a float between 0.0 and 1.0. Never guess unreadable text. Do not provide medical diagnosis or advice."
)


def azure_ocr(raw: bytes) -> dict:
    import httpx

    ep = (AZURE_ENDPOINT or "").rstrip("/")
    if ep.endswith("/openai/v1"):
        ep = ep[:-len("/openai/v1")].rstrip("/")
    key = AZURE_KEY
    dep = AZURE_DEPLOY
    img = "data:image/png;base64," + base64.b64encode(raw).decode()

    last_err = None
    for attempt in range(3):
        try:
            r = httpx.post(
                f"{ep}/openai/deployments/{dep}/chat/completions?api-version=2024-06-01",
                headers={"api-key": key},
                timeout=35,
                json={
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": PROMPT},
                        {
                            "role": "user",
                            "content": [{"type": "image_url", "image_url": {"url": img}}],
                        },
                    ],
                },
            )
            r.raise_for_status()
            parsed = json.loads(r.json()["choices"][0]["message"]["content"])
            if parsed.get("doctor_reg"):
                parsed["doctor_validation"] = validate_doctor_reg(parsed["doctor_reg"])
            return parsed
        except httpx.HTTPStatusError as e:
            last_err = e
            if e.response.status_code in (500, 502, 503, 429) and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except Exception as e:
            last_err = e
            if attempt < 2:
                time.sleep(1.0)
                continue
            raise
    raise last_err


def extract(raw: bytes, demo: str) -> dict:
    if demo and demo in DEMOS:
        return DEMOS[demo]
    if raw and AZURE_ENDPOINT and AZURE_KEY:
        try:
            return azure_ocr(raw)
        except Exception as e:
            logger.warning(f"Azure OCR extraction failed: {e}. Falling back to demo/pharmacist review.")
            return {"legible": None, "lines": [], "doctor": None}
    demo_data = DEMOS.get(demo, {"legible": None, "lines": [], "doctor": None})
    return demo_data


def demo_png(kind: str) -> bytes:
    if kind not in DEMOS:
        return b""
    im = Image.new("RGB", (560, 380), "white")
    draw = ImageDraw.Draw(im)
    draw.text((20, 20), "Dr. A. Banerjee, Reg. No. WB-12345 (WBMC)", fill="black")
    lines = DEMOS[kind].get("lines") or [{"text": "illegible"}]
    for i, line in enumerate(lines):
        draw.text(
            (30, 80 + i * 40),
            f"Rx  {line['text']}   x{line.get('qty', '')}",
            fill="black",
        )
    if kind == "blurry":
        im = im.filter(ImageFilter.GaussianBlur(7))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()
