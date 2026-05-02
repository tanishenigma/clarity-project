"""
inference.py
============
Generate exam questions (or predict next question topics) using your
fine-tuned T5-Large model.

Usage examples:

  # Generate a question for a given course
  python inference.py \
      --model_path outputs/t5_large_exam/best_model \
      --task question_generation \
      --course "Molecular Biology" \
      --department "BT" \
      --outcome "CO4"

  # Predict topic of next question given an existing question
  python inference.py \
      --model_path outputs/t5_large_exam/best_model \
      --task question_prediction \
      --question "Explain the role of telomerase in cancer."

  # Interactive REPL mode
  python inference.py --model_path outputs/t5_large_exam/best_model --interactive
"""

import argparse
import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer

from config import CONFIG


# ──────────────────────────────────────────────
# Model loader
# ──────────────────────────────────────────────

def load_model(model_path: str):
    """Load a fine-tuned model and tokenizer from disk."""
    print(f"Loading model from: {model_path}")
    tokenizer = T5Tokenizer.from_pretrained(model_path)
    model     = T5ForConditionalGeneration.from_pretrained(model_path)
    device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    print(f"Model ready on {device}")
    return model, tokenizer, device


# ──────────────────────────────────────────────
# Generation helpers
# ──────────────────────────────────────────────

def generate(
    model,
    tokenizer,
    device,
    input_text: str,
    num_beams: int       = 4,
    max_length: int      = 256,
    num_return_sequences: int = 1,
    temperature: float   = 1.0,
    no_repeat_ngram: int = 3,
    repetition_penalty: float = 1.5,
) -> list[str]:
    """Run beam-search generation and return decoded strings."""
    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        max_length=256,
        truncation=True,
        padding=True,
    ).to(device)

    with torch.no_grad():
        output_ids = model.generate(
            input_ids      = inputs["input_ids"],
            attention_mask = inputs["attention_mask"],
            max_length     = max_length,
            num_beams      = num_beams,
            num_return_sequences = num_return_sequences,
            no_repeat_ngram_size = no_repeat_ngram,
            repetition_penalty   = repetition_penalty,
            early_stopping = True,
            temperature    = temperature,
        )

    return [tokenizer.decode(ids, skip_special_tokens=True) for ids in output_ids]


# ──────────────────────────────────────────────
# Task-specific prompt builders
# ──────────────────────────────────────────────

def build_generation_prompt(
    course: str,
    department: str = "",
    program: str    = "B.Tech",
    semester: str   = "EVEN SEMESTER",
    exam: str       = "T-3",
    outcome: str    = "general",
) -> str:
    return (
        f"generate question: "
        f"course: {course} | "
        f"department: {department} | "
        f"program: {program} | "
        f"semester: {semester} | "
        f"exam: {exam} | "
        f"outcome: {outcome}"
    )


def build_prediction_prompt(question: str) -> str:
    return f"predict next question topic: {question}"


# ──────────────────────────────────────────────
# Batch generation from a list of metadata dicts
# ──────────────────────────────────────────────

def generate_paper(
    model,
    tokenizer,
    device,
    course: str,
    department: str,
    outcomes: list[str],
    num_questions_per_outcome: int = 2,
    cfg = CONFIG,
) -> dict:
    """
    Generate a mini question paper for a course.
    Returns a dict mapping outcome → list of generated questions.
    """
    paper = {}
    for co in outcomes:
        prompt = build_generation_prompt(
            course     = course,
            department = department,
            outcome    = co,
        )
        questions = generate(
            model, tokenizer, device,
            input_text           = prompt,
            num_beams            = cfg.num_beams,
            max_length           = cfg.max_gen_len,
            num_return_sequences = num_questions_per_outcome,
            no_repeat_ngram      = cfg.no_repeat_ngram_size,
            repetition_penalty   = cfg.repetition_penalty,
        )
        paper[co] = questions
    return paper


def print_paper(paper: dict, course: str):
    print(f"\n{'='*60}")
    print(f"  Generated Question Paper — {course}")
    print(f"{'='*60}")
    q_num = 1
    for co, questions in paper.items():
        print(f"\n[{co}]")
        for q in questions:
            print(f"  Q{q_num}. {q}")
            q_num += 1
    print(f"{'='*60}\n")


# ──────────────────────────────────────────────
# Interactive REPL
# ──────────────────────────────────────────────

def interactive_mode(model, tokenizer, device, cfg=CONFIG):
    print("\nInteractive mode — type 'quit' to exit")
    print("Commands: 'gen' = generate question | 'pred' = predict topic\n")

    while True:
        cmd = input("Command [gen/pred/quit]: ").strip().lower()
        if cmd == "quit":
            break
        elif cmd == "gen":
            course = input("Course name: ").strip()
            dept   = input("Department (e.g. BT, CSE): ").strip()
            co     = input("Course outcome (e.g. CO4, general): ").strip() or "general"
            prompt = build_generation_prompt(course, dept, outcome=co)
            print(f"\nPrompt: {prompt}")
            results = generate(model, tokenizer, device, prompt,
                               num_beams=cfg.num_beams, max_length=cfg.max_gen_len,
                               num_return_sequences=3)
            print("\nGenerated questions:")
            for i, q in enumerate(results, 1):
                print(f"  {i}. {q}")
        elif cmd == "pred":
            question = input("Enter existing question: ").strip()
            prompt   = build_prediction_prompt(question)
            results  = generate(model, tokenizer, device, prompt,
                                num_beams=4, max_length=64)
            print(f"\nPredicted topic: {results[0]}")
        else:
            print("Unknown command. Use gen, pred, or quit.")
        print()


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--model_path", type=str, default="outputs/t5_large_exam/best_model")
    p.add_argument("--task",       type=str, default="question_generation",
                   choices=["question_generation", "question_prediction"])
    p.add_argument("--course",     type=str, default="")
    p.add_argument("--department", type=str, default="")
    p.add_argument("--outcome",    type=str, default="general")
    p.add_argument("--question",   type=str, default="")
    p.add_argument("--interactive",action="store_true")
    p.add_argument("--generate_paper", action="store_true",
                   help="Generate a full mini paper for the given course")
    p.add_argument("--outcomes",   type=str, default="CO1,CO2,CO3,CO4,CO5",
                   help="Comma-separated list of COs for --generate_paper")
    return p.parse_args()


if __name__ == "__main__":
    args  = parse_args()
    model, tokenizer, device = load_model(args.model_path)
    cfg   = CONFIG

    if args.interactive:
        interactive_mode(model, tokenizer, device, cfg)

    elif args.generate_paper:
        outcomes = [o.strip() for o in args.outcomes.split(",")]
        paper    = generate_paper(model, tokenizer, device,
                                  course=args.course,
                                  department=args.department,
                                  outcomes=outcomes)
        print_paper(paper, args.course)

    elif args.task == "question_generation":
        prompt = build_generation_prompt(
            course=args.course, department=args.department, outcome=args.outcome
        )
        print(f"Prompt: {prompt}")
        results = generate(model, tokenizer, device, prompt,
                           num_beams=cfg.num_beams, max_length=cfg.max_gen_len,
                           num_return_sequences=3)
        print("\nGenerated questions:")
        for i, q in enumerate(results, 1):
            print(f"  {i}. {q}")

    elif args.task == "question_prediction":
        prompt  = build_prediction_prompt(args.question)
        results = generate(model, tokenizer, device, prompt, num_beams=4, max_length=64)
        print(f"Predicted topic: {results[0]}")
