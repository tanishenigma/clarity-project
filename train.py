"""
T5 Fine-Tuning Script — CRAG QA Task
=====================================
Fine-tunes the T5 model on reading-comprehension QA so it learns the exact
input format used by generator.py:

    "question: <query> context: <context>"  →  "<answer>"

Training data (in priority order):
  1. data/custom_qa.jsonl  — Your own QA pairs (optional, highest priority)
  2. SQuAD v1.1             — Standard reading comprehension benchmark

Usage:
    .venv/bin/python train.py [--epochs N] [--batch-size N] [--lr FLOAT]

The fine-tuned model is saved back to Model/T5_FineTuned/ when done.
"""

import argparse
import os
import sys

import torch
from datasets import load_dataset, Dataset
from torch.utils.data import DataLoader
from transformers import T5ForConditionalGeneration, T5Tokenizer

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "Model", "T5_FineTuned")
CUSTOM_DATA_PATH = os.path.join(BASE_DIR, "data", "custom_qa.jsonl")

# ── Defaults ──────────────────────────────────────────────────────────────────

MAX_INPUT_LEN = 512
MAX_TARGET_LEN = 128
DEFAULT_EPOCHS = 3
DEFAULT_BATCH = 4
DEFAULT_LR = 3e-4
# How many SQuAD examples to use (keeps training time reasonable on CPU)
SQUAD_MAX_EXAMPLES = 5000


# ── Dataset helpers ───────────────────────────────────────────────────────────


def load_squad_examples(max_examples: int) -> list[dict]:
    """Load SQuAD v1 from HuggingFace and return flat list of {input, target}."""
    print(f"[Train] Downloading SQuAD v1.1 (up to {max_examples} examples)…")
    squad = load_dataset("rajpurkar/squad", split="train", trust_remote_code=True)
    examples = []
    for row in squad:
        if len(examples) >= max_examples:
            break
        question = row["question"].strip()
        context = row["context"].strip()
        # SQuAD answers is a dict with a 'text' list
        answers = row["answers"]["text"]
        if not answers:
            continue
        answer = answers[0].strip()
        input_text = f"question: {question} context: {context}"
        examples.append({"input": input_text, "target": answer})
    print(f"[Train] Loaded {len(examples)} SQuAD examples")
    return examples


def load_custom_examples(path: str) -> list[dict]:
    """
    Load custom QA pairs from a JSONL file.
    Each line must be: {"question": "...", "context": "...", "answer": "..."}
    """
    if not os.path.exists(path):
        return []
    import json

    examples = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
                q = row.get("question", "").strip()
                c = row.get("context", "").strip()
                a = row.get("answer", "").strip()
                if q and c and a:
                    examples.append(
                        {"input": f"question: {q} context: {c}", "target": a}
                    )
            except json.JSONDecodeError:
                continue
    print(f"[Train] Loaded {len(examples)} custom examples from {path}")
    return examples


def tokenize_batch(batch, tokenizer):
    model_inputs = tokenizer(
        batch["input"],
        max_length=MAX_INPUT_LEN,
        truncation=True,
        padding="max_length",
    )
    labels = tokenizer(
        batch["target"],
        max_length=MAX_TARGET_LEN,
        truncation=True,
        padding="max_length",
    )
    # Replace pad token id in labels with -100 so loss ignores padding
    label_ids = labels["input_ids"]
    label_ids = [
        [(l if l != tokenizer.pad_token_id else -100) for l in lbl]
        for lbl in label_ids
    ]
    model_inputs["labels"] = label_ids
    return model_inputs


# ── Training loop ─────────────────────────────────────────────────────────────


def train(epochs: int, batch_size: int, lr: float):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Train] Device: {device}")

    # Load model and tokenizer
    print(f"[Train] Loading model from {MODEL_PATH}")
    tokenizer = T5Tokenizer.from_pretrained(MODEL_PATH)
    model = T5ForConditionalGeneration.from_pretrained(
        MODEL_PATH, use_safetensors=True
    )
    model = model.to(device)
    model.train()

    # Build dataset
    custom = load_custom_examples(CUSTOM_DATA_PATH)
    squad = load_squad_examples(SQUAD_MAX_EXAMPLES)
    # Custom examples first — they have higher relevance
    all_examples = custom + squad
    if not all_examples:
        print("[Train] ERROR: No training data found. Aborting.")
        sys.exit(1)

    print(f"[Train] Total examples: {len(all_examples)}")

    raw_dataset = Dataset.from_list(all_examples)
    tokenized = raw_dataset.map(
        lambda b: tokenize_batch(b, tokenizer),
        batched=True,
        remove_columns=["input", "target"],
        desc="Tokenizing",
    )
    tokenized.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])
    loader = DataLoader(tokenized, batch_size=batch_size, shuffle=True)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)

    total_steps = len(loader) * epochs
    print(f"[Train] Steps per epoch: {len(loader)}, total: {total_steps}")

    global_step = 0
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        for step, batch in enumerate(loader, 1):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            optimizer.zero_grad()

            epoch_loss += loss.item()
            global_step += 1

            if step % 50 == 0 or step == len(loader):
                avg = epoch_loss / step
                pct = 100 * global_step / total_steps
                print(
                    f"[Train] Epoch {epoch}/{epochs}  step {step}/{len(loader)}"
                    f"  loss={avg:.4f}  ({pct:.1f}% done)"
                )

        print(f"[Train] ── Epoch {epoch} complete, avg loss={epoch_loss / len(loader):.4f}")

    # Save fine-tuned model back to the same path
    print(f"[Train] Saving fine-tuned model → {MODEL_PATH}")
    model.save_pretrained(MODEL_PATH)
    tokenizer.save_pretrained(MODEL_PATH)
    print("[Train] Done. Model saved.")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune T5 for CRAG QA")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH)
    parser.add_argument("--lr", type=float, default=DEFAULT_LR)
    parser.add_argument(
        "--squad-examples",
        type=int,
        default=SQUAD_MAX_EXAMPLES,
        help="Number of SQuAD examples to include (default: 5000)",
    )
    args = parser.parse_args()
    SQUAD_MAX_EXAMPLES = args.squad_examples

    train(args.epochs, args.batch_size, args.lr)
