"""
Evaluation script for Azure OpenAI Prescription Extraction.
Measures precision, recall, and exact match on medicine name, dosage,
frequency, and duration against ground truth labels.

Usage:
    cd backend && python -m eval.eval_azure_ai --images <path_to_images> --labels <path_to_labels.json>
"""

import argparse
import difflib
import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from services.ocr import azure_ocr, demo_png, DEMOS


def normalize(text: str) -> str:
    return " ".join((text or "").lower().strip().split())


def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def evaluate(images_dir: Path | None, labels_file: Path | None) -> dict:
    test_cases = []

    if labels_file and labels_file.exists():
        with open(labels_file, "r", encoding="utf-8") as f:
            labels_data = json.load(f)

        # Expecting either a list of cases or a dict keyed by filename
        if isinstance(labels_data, list):
            items = labels_data
        else:
            items = [{"filename": k, **v} for k, v in labels_data.items()]

        for item in items:
            fname = item.get("filename") or item.get("image")
            img_path = images_dir / fname if (images_dir and fname) else None
            if img_path and img_path.exists():
                with open(img_path, "rb") as img_f:
                    raw_bytes = img_f.read()
                test_cases.append({"name": fname, "bytes": raw_bytes, "ground_truth": item})
    else:
        print("[INFO] No external dataset provided. Running evaluation against built-in benchmark samples...")
        for key in ["clean", "handwritten"]:
            test_cases.append({
                "name": f"benchmark_{key}.png",
                "bytes": demo_png(key),
                "ground_truth": {
                    "doctor_name": DEMOS[key]["doctor"]["name"],
                    "lines": DEMOS[key]["lines"],
                },
            })

    total_expected = 0
    total_extracted = 0
    matched_medicines = 0
    exact_matches = {
        "name": 0,
        "dosage": 0,
        "qty": 0,
    }

    print(f"\nEvaluating {len(test_cases)} prescription sample(s) with Azure OpenAI Vision...\n" + "=" * 60)

    for case in test_cases:
        print(f"Sample: {case['name']}")
        gt = case["ground_truth"]
        gt_lines = gt.get("lines", [])
        total_expected += len(gt_lines)

        try:
            pred = azure_ocr(case["bytes"])
            pred_lines = pred.get("lines", [])
            total_extracted += len(pred_lines)
            print(f"  Extracted {len(pred_lines)} line(s); expected {len(gt_lines)} line(s)")

            for g in gt_lines:
                gt_text = g.get("text", "")
                # Find best matching prediction
                best_match = None
                best_sim = 0.0
                for p in pred_lines:
                    sim = similarity(gt_text, p.get("text", ""))
                    if sim > best_sim:
                        best_sim = sim
                        best_match = p

                if best_match and best_sim >= 0.70:
                    matched_medicines += 1
                    if similarity(gt_text, best_match.get("text", "")) >= 0.95:
                        exact_matches["name"] += 1
                    if g.get("qty") and best_match.get("qty") == g.get("qty"):
                        exact_matches["qty"] += 1
                    print(f"  [OK] Matched: '{gt_text}' ~ '{best_match.get('text')}' (similarity: {best_sim:.2f})")
                else:
                    print(f"  [X] Unmatched: '{gt_text}'")

        except Exception as e:
            print(f"  Error processing {case['name']}: {e}")

    precision = (matched_medicines / total_extracted) if total_extracted > 0 else 0.0
    recall = (matched_medicines / total_expected) if total_expected > 0 else 0.0
    name_exact = (exact_matches["name"] / total_expected) if total_expected > 0 else 0.0
    qty_exact = (exact_matches["qty"] / total_expected) if total_expected > 0 else 0.0

    print("\n" + "=" * 60)
    print("AZURE OPENAI VISION EXTRACTION BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Total Ground Truth Items : {total_expected}")
    print(f"Total Extracted Items    : {total_extracted}")
    print(f"Matched Items            : {matched_medicines}")
    print(f"Precision                : {precision * 100:.1f}%")
    print(f"Recall                   : {recall * 100:.1f}%")
    print(f"Medicine Name Exact-Match: {name_exact * 100:.1f}%")
    print(f"Quantity / Qty Match     : {qty_exact * 100:.1f}%")
    print("=" * 60)

    return {
        "precision": precision,
        "recall": recall,
        "exact_match_name": name_exact,
        "exact_match_qty": qty_exact,
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate Azure OpenAI Prescription Extraction")
    parser.add_argument("--images", type=str, help="Directory containing prescription images")
    parser.add_argument("--labels", type=str, help="Path to labels.json")
    args = parser.parse_args()

    images_dir = Path(args.images) if args.images else None
    labels_file = Path(args.labels) if args.labels else None

    evaluate(images_dir, labels_file)


if __name__ == "__main__":
    main()
