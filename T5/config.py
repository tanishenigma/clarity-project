"""
config.py
=========
Central configuration for the T5-Large fine-tuning pipeline.
Edit this file to change hyperparameters, paths, and task settings.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TrainConfig:
    # ── Paths ──────────────────────────────────────────────────────────────
    data_path: str = "data/questions.jsonl"
    # Path to your local .jsonl or .json dataset file.
    # Example: "C:/Users/you/Downloads/juit_questions.jsonl"

    output_dir: str = "outputs/t5_large_exam"
    # Where checkpoints + final model are saved.

    log_dir: str = "outputs/logs"
    # TensorBoard log directory.

    # ── Model ──────────────────────────────────────────────────────────────
    model_name: str = "google/t5-large"
    # Options: "t5-base", "google/t5-large", "google/flan-t5-large"
    # flan-t5-large often works better for instruction-style tasks.

    # ── Task ───────────────────────────────────────────────────────────────
    task: str = "question_generation"
    # "question_generation"  → course metadata → generate exam question
    # "question_prediction"  → existing question → predict next topic/CO

    # ── Tokenization ───────────────────────────────────────────────────────
    max_input_len: int = 256
    max_target_len: int = 256

    # ── Training hyperparameters ────────────────────────────────────────────
    num_epochs: int = 10
    train_batch_size: int = 4      # Lower if you hit OOM on your GPU
    val_batch_size: int = 8
    gradient_accumulation_steps: int = 4   # Effective batch = 4×4 = 16
    learning_rate: float = 3e-4
    weight_decay: float = 0.01
    warmup_ratio: float = 0.1             # 10% of steps for LR warmup
    max_grad_norm: float = 1.0

    # ── Mixed precision ─────────────────────────────────────────────────────
    use_fp16: bool = True
    # Set False if your GPU doesn't support fp16 (older cards)

    # ── Evaluation & saving ─────────────────────────────────────────────────
    eval_every_n_steps: int = 200
    save_every_n_steps: int = 500
    val_ratio: float = 0.1
    patience: int = 5              # Early stopping: stop after N evals w/o improvement

    # ── Generation (inference) ──────────────────────────────────────────────
    num_beams: int = 4
    max_gen_len: int = 256
    no_repeat_ngram_size: int = 3
    repetition_penalty: float = 1.5

    # ── Reproducibility ─────────────────────────────────────────────────────
    seed: int = 42
    num_workers: int = 2           # DataLoader workers (set 0 on Windows)

    # ── Checkpoint resume ───────────────────────────────────────────────────
    resume_from_checkpoint: Optional[str] = None
    # Set to a checkpoint path like "outputs/t5_large_exam/checkpoint-500"
    # to resume interrupted training.


# Singleton config — import this everywhere
CONFIG = TrainConfig()
