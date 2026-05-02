"""
prepare_data.py
===============
Run this BEFORE training to inspect, clean, and validate your dataset.
Produces a summary report and optionally saves cleaned splits to disk.

Usage:
    python prepare_data.py --data_path data/questions.jsonl
    python prepare_data.py --data_path data/questions.jsonl --save_splits
"""

import argparse
import json
from pathlib import Path
from collections import Counter

from data_utils import load_dataset_from_path, records_to_pairs, split_pairs, clean_text


def analyze_records(records: list) -> dict:
    """Print dataset statistics."""
    stats = {
        "total_records":    len(records),
        "courses":          Counter(),
        "departments":      Counter(),
        "exam_types":       Counter(),
        "semesters":        Counter(),
        "cos":              Counter(),
        "has_marks":        0,
        "has_co":           0,
        "avg_q_len":        0,
        "empty_questions":  0,
    }

    total_len = 0
    for r in records:
        q = r.get("question_text", "")
        if not q.strip():
            stats["empty_questions"] += 1
            continue
        cleaned = clean_text(q)
        total_len += len(cleaned.split())

        stats["courses"][r.get("course_name", "Unknown")] += 1
        for dept in r.get("departments", ["Unknown"]):
            stats["departments"][dept] += 1
        stats["exam_types"][r.get("exam_type", "Unknown")] += 1
        stats["semesters"][r.get("semester", "Unknown")] += 1
        co = r.get("co", "")
        stats["cos"][co if co else "none"] += 1
        if r.get("marks"):
            stats["has_marks"] += 1
        if co:
            stats["has_co"] += 1

    valid = stats["total_records"] - stats["empty_questions"]
    stats["avg_q_len"] = round(total_len / max(valid, 1), 1)
    return stats


def print_stats(stats: dict):
    print("\n" + "="*60)
    print("  DATASET ANALYSIS")
    print("="*60)
    print(f"  Total records:     {stats['total_records']}")
    print(f"  Empty questions:   {stats['empty_questions']}")
    print(f"  Records with marks:{stats['has_marks']}")
    print(f"  Records with CO:   {stats['has_co']}")
    print(f"  Avg question len:  {stats['avg_q_len']} words")

    print(f"\n  Top 10 Courses:")
    for name, cnt in stats["courses"].most_common(10):
        print(f"    {cnt:4d}  {name[:55]}")

    print(f"\n  Departments:  {dict(stats['departments'])}")
    print(f"  Exam types:   {dict(stats['exam_types'])}")
    print(f"  Semesters:    {dict(stats['semesters'])}")

    co_dist = {k: v for k, v in stats["cos"].most_common(10)}
    print(f"\n  Course Outcomes (top 10): {co_dist}")
    print("="*60 + "\n")


def save_splits(train_pairs, val_pairs, out_dir: str):
    Path(out_dir).mkdir(parents=True, exist_ok=True)

    for split_name, pairs in [("train", train_pairs), ("val", val_pairs)]:
        path = Path(out_dir) / f"{split_name}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for inp, tgt in pairs:
                f.write(json.dumps({"input": inp, "target": tgt}) + "\n")
        print(f"Saved {len(pairs)} {split_name} pairs → {path}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data_path",   type=str, required=True,
                   help="Path to your .jsonl or .json dataset")
    p.add_argument("--task",        type=str, default="question_generation",
                   choices=["question_generation", "question_prediction"])
    p.add_argument("--val_ratio",   type=float, default=0.1)
    p.add_argument("--save_splits", action="store_true",
                   help="Save cleaned train/val JSONL files to data/splits/")
    p.add_argument("--out_dir",     type=str, default="data/splits")
    args = p.parse_args()

    # Load
    records = load_dataset_from_path(args.data_path)

    # Analyze raw
    stats = analyze_records(records)
    print_stats(stats)

    # Convert to pairs
    pairs = records_to_pairs(records, task=args.task)

    # Check for very short/long pairs
    short = sum(1 for inp, tgt in pairs if len(tgt.split()) < 5)
    long  = sum(1 for inp, tgt in pairs if len(tgt.split()) > 200)
    print(f"Pair quality → Short targets (<5 words): {short} | Long targets (>200 words): {long}")

    # Split
    train_pairs, val_pairs = split_pairs(pairs, val_ratio=args.val_ratio)

    # Save if requested
    if args.save_splits:
        save_splits(train_pairs, val_pairs, args.out_dir)

    print("\n✓ Data preparation complete. You can now run:")
    print(f"   python train.py --data_path {args.data_path}\n")


if __name__ == "__main__":
    main()
