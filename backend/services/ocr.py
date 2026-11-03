import base64
import io
import json
import os
from PIL import Image, ImageDraw, ImageFilter
from core.config import AZURE_ENDPOINT, AZURE_KEY, AZURE_DEPLOY

DEMOS = {
    "clean": {
        "legible": True,
        "lines": [
            {"text": "Metformin 500 mg", "qty": 4, "conf": 0.98},
            {"text": "Telmisartan 40 mg", "qty": 3, "conf": 0.97},
        ],
    },
    "handwritten": {
        "legible": True,
        "lines": [{"text": "Levothyroxin 50 mcg", "qty": 1, "conf": 0.54}],
    },
    "blurry": {"legible": False, "lines": []},
    "s50211": {"legible": True, "lines": [{"text": "Metformin 500 mg", "qty": 4}]},
    "s50214": {"legible": True, "lines": [{"text": "Telmisartan 40 mg", "qty": 3}]},
    "h1": {
        "legible": True,
        "lines": [{"text": "Alprazolam 0.25 mg", "qty": 1, "conf": 0.93}],
    },
    "schedx": {
        "legible": True,
        "lines": [
            {"text": "Demo Narcotic 5 mg", "qty": 1, "conf": 0.90},
            {"text": "Paracetamol 500 mg", "qty": 2, "conf": 0.95},
        ],
    },
}

PROMPT = (
    "Read this prescription. Return JSON {legible:bool, lines:[{text,qty,conf}]} with conf 0-1. "
    "Never guess unreadable text. No medical advice."
)


def azure_ocr(raw: bytes):
    import httpx

    ep = AZURE_ENDPOINT
    key = AZURE_KEY
    dep = AZURE_DEPLOY
    img = "data:image/png;base64," + base64.b64encode(raw).decode()

    r = httpx.post(
        f"{ep}/openai/deployments/{dep}/chat/completions?api-version=2024-06-01",
        headers={"api-key": key},
        timeout=30,
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
    return json.loads(r.json()["choices"][0]["message"]["content"])


def extract(raw: bytes, demo: str):
    if AZURE_ENDPOINT and AZURE_KEY:
        try:
            return azure_ocr(raw)
        except Exception as e:
            print(f"[azure] extraction failed: {e}", flush=True)
            return {"legible": None, "lines": []}  # Fallback to manual pharmacist review
    return DEMOS.get(demo, {"legible": None, "lines": []})


def demo_png(kind: str) -> bytes:
    if kind not in DEMOS:
        return b""
    im = Image.new("RGB", (560, 380), "white")
    draw = ImageDraw.Draw(im)
    draw.text((20, 20), "Dr. A. Banerjee, Reg. No. WB-12345 (sample)", fill="black")
    lines = DEMOS[kind]["lines"] or [{"text": "illegible"}]
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
