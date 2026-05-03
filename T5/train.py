"""
train.py
========
Main training script for fine-tuning T5-Large on JUIT exam question data.

Usage:
    python train.py                          # uses config.py defaults
    python train.py --data_path my_data.jsonl --num_epochs 15
    python train.py --resume_from_checkpoint outputs/t5_large_exam/checkpoint-500
"""

import os
import sys
import argparse
import random
import math
import time
import logging
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.utils.tensorboard import SummaryWriter
from transformers import (
    T5ForConditionalGeneration,
    T5Tokenizer,
    get_linear_schedule_with_warmup,
)
from tqdm import tqdm

# Local imports
from config import CONFIG, TrainConfig
from data_utils import build_datasets

# ──────────────────────────────────────────────
# Logging setup
# ──────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def count_parameters(model) -> str:
    total  = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return f"Total: {total/1e6:.1f}M | Trainable: {trainable/1e6:.1f}M"


def save_checkpoint(model, tokenizer, optimizer, scheduler, step, loss, cfg: TrainConfig):
    ckpt_dir = Path(cfg.output_dir) / f"checkpoint-{step}"
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(ckpt_dir)
    tokenizer.save_pretrained(ckpt_dir)
    torch.save({
        "step":       step,
        "loss":       loss,
        "optimizer":  optimizer.state_dict(),
        "scheduler":  scheduler.state_dict(),
    }, ckpt_dir / "trainer_state.pt")
    logger.info(f"Checkpoint saved → {ckpt_dir}")
    return str(ckpt_dir)


def load_checkpoint(model, tokenizer, optimizer, scheduler, cfg: TrainConfig):
    ckpt = cfg.resume_from_checkpoint
    if not ckpt or not Path(ckpt).exists():
        return 0, float("inf")
    logger.info(f"Resuming from checkpoint: {ckpt}")
    model      = T5ForConditionalGeneration.from_pretrained(ckpt)
    state_dict = torch.load(Path(ckpt) / "trainer_state.pt", map_location="cpu")
    optimizer.load_state_dict(state_dict["optimizer"])
    scheduler.load_state_dict(state_dict["scheduler"])
    return state_dict["step"], state_dict["loss"]


# ──────────────────────────────────────────────
# Evaluation
# ──────────────────────────────────────────────

@torch.no_grad()
def evaluate(model, val_loader, device, scaler=None):
    model.eval()
    total_loss = 0.0
    steps = 0
    for batch in val_loader:
        input_ids      = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels         = batch["labels"].to(device)

        if scaler is not None:
            with torch.cuda.amp.autocast():
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels,
                )
        else:
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )

        total_loss += outputs.loss.item()
        steps += 1

    model.train()
    return total_loss / max(steps, 1)


# ──────────────────────────────────────────────
# Training loop
# ──────────────────────────────────────────────

def train(cfg: TrainConfig):
    set_seed(cfg.seed)

    # ── Device ──────────────────────────────────
    if torch.cuda.is_available():
        device = torch.device("cuda")
        logger.info(f"GPU: {torch.cuda.get_device_name(0)} | "
                    f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    else:
        device = torch.device("cpu")
        logger.warning("No GPU found — training on CPU (this will be slow)")

    # ── Model & Tokenizer ───────────────────────
    logger.info(f"Loading model: {cfg.model_name}")
    tokenizer = T5Tokenizer.from_pretrained(cfg.model_name)
    model     = T5ForConditionalGeneration.from_pretrained(cfg.model_name)
    model.to(device)
    logger.info(f"Parameters → {count_parameters(model)}")

    # ── Datasets & DataLoaders ──────────────────
    logger.info(f"Loading data from: {cfg.data_path}")
    train_ds, val_ds = build_datasets(
        data_path     = cfg.data_path,
        tokenizer     = tokenizer,
        task          = cfg.task,
        max_input_len = cfg.max_input_len,
        max_target_len= cfg.max_target_len,
        val_ratio     = cfg.val_ratio,
    )

    train_loader = DataLoader(
        train_ds,
        batch_size  = cfg.train_batch_size,
        shuffle     = True,
        num_workers = cfg.num_workers,
        pin_memory  = device.type == "cuda",
    )
    val_loader = DataLoader(
        val_ds,
        batch_size  = cfg.val_batch_size,
        shuffle     = False,
        num_workers = cfg.num_workers,
        pin_memory  = device.type == "cuda",
    )

    # ── Optimizer & Scheduler ───────────────────
    optimizer = AdamW(
        model.parameters(),
        lr           = cfg.learning_rate,
        weight_decay = cfg.weight_decay,
    )

    total_steps  = math.ceil(len(train_loader) / cfg.gradient_accumulation_steps) * cfg.num_epochs
    warmup_steps = int(total_steps * cfg.warmup_ratio)
    scheduler    = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps   = warmup_steps,
        num_training_steps = total_steps,
    )
    logger.info(f"Total optimizer steps: {total_steps} | Warmup steps: {warmup_steps}")

    # ── Mixed precision ─────────────────────────
    scaler = torch.amp.GradScaler("cuda") if (cfg.use_fp16 and device.type == "cuda") else None
    if scaler:
        logger.info("Mixed precision (fp16) enabled")

    # ── TensorBoard ─────────────────────────────
    Path(cfg.log_dir).mkdir(parents=True, exist_ok=True)
    writer = SummaryWriter(log_dir=cfg.log_dir)

    # ── Resume ──────────────────────────────────
    global_step = 0
    best_val_loss = float("inf")
    no_improve_count = 0

    if cfg.resume_from_checkpoint:
        global_step, best_val_loss = load_checkpoint(
            model, tokenizer, optimizer, scheduler, cfg
        )
        model.to(device)

    # ── Training ────────────────────────────────
    logger.info(f"\n{'='*60}")
    logger.info(f"  Task:       {cfg.task}")
    logger.info(f"  Epochs:     {cfg.num_epochs}")
    logger.info(f"  Train size: {len(train_ds)}")
    logger.info(f"  Val size:   {len(val_ds)}")
    logger.info(f"  Eff. batch: {cfg.train_batch_size * cfg.gradient_accumulation_steps}")
    logger.info(f"{'='*60}\n")

    model.train()
    optimizer.zero_grad()

    for epoch in range(1, cfg.num_epochs + 1):
        epoch_loss = 0.0
        epoch_steps = 0
        progress = tqdm(train_loader, desc=f"Epoch {epoch}/{cfg.num_epochs}", leave=True)

        for step, batch in enumerate(progress, 1):
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels         = batch["labels"].to(device)

            # Forward
            if scaler:
                with torch.amp.autocast("cuda"):
                    outputs = model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels,
                    )
                loss = outputs.loss / cfg.gradient_accumulation_steps
                scaler.scale(loss).backward()
            else:
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels,
                )
                loss = outputs.loss / cfg.gradient_accumulation_steps
                loss.backward()

            epoch_loss  += outputs.loss.item()
            epoch_steps += 1

            # Gradient accumulation
            if step % cfg.gradient_accumulation_steps == 0:
                if scaler:
                    scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.max_grad_norm)
                if scaler:
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    optimizer.step()
                scheduler.step()
                optimizer.zero_grad()
                global_step += 1

                # Log training loss
                writer.add_scalar("Loss/train_step", outputs.loss.item(), global_step)
                writer.add_scalar("LR", scheduler.get_last_lr()[0], global_step)
                progress.set_postfix(loss=f"{outputs.loss.item():.4f}", lr=f"{scheduler.get_last_lr()[0]:.2e}")

                # Evaluation
                if global_step % cfg.eval_every_n_steps == 0:
                    val_loss = evaluate(model, val_loader, device, scaler)
                    writer.add_scalar("Loss/val", val_loss, global_step)
                    logger.info(
                        f"[Step {global_step}] Val Loss: {val_loss:.4f} | "
                        f"Best: {best_val_loss:.4f}"
                    )

                    if val_loss < best_val_loss:
                        best_val_loss    = val_loss
                        no_improve_count = 0
                        # Save best model
                        best_dir = Path(cfg.output_dir) / "best_model"
                        best_dir.mkdir(parents=True, exist_ok=True)
                        model.save_pretrained(best_dir)
                        tokenizer.save_pretrained(best_dir)
                        logger.info(f"✓ New best model saved → {best_dir}")
                    else:
                        no_improve_count += 1
                        if no_improve_count >= cfg.patience:
                            logger.info(
                                f"Early stopping triggered after {cfg.patience} "
                                f"evals without improvement."
                            )
                            # Final save and exit
                            final_dir = Path(cfg.output_dir) / "final_model"
                            model.save_pretrained(final_dir)
                            tokenizer.save_pretrained(final_dir)
                            writer.close()
                            return

                # Periodic checkpoint
                if global_step % cfg.save_every_n_steps == 0:
                    save_checkpoint(model, tokenizer, optimizer, scheduler,
                                    global_step, epoch_loss / epoch_steps, cfg)

        # End of epoch
        avg_epoch_loss = epoch_loss / max(epoch_steps, 1)
        writer.add_scalar("Loss/train_epoch", avg_epoch_loss, epoch)
        logger.info(f"Epoch {epoch} complete | Avg Train Loss: {avg_epoch_loss:.4f}")

    # ── Save final model ─────────────────────────
    final_dir = Path(cfg.output_dir) / "final_model"
    final_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(final_dir)
    tokenizer.save_pretrained(final_dir)
    logger.info(f"\nTraining complete! Final model saved → {final_dir}")
    logger.info(f"Best val loss: {best_val_loss:.4f}")
    writer.close()


# ──────────────────────────────────────────────
# CLI argument overrides
# ──────────────────────────────────────────────

def parse_args() -> TrainConfig:
    parser = argparse.ArgumentParser(description="Fine-tune T5-Large on JUIT exam questions")
    parser.add_argument("--data_path",               type=str)
    parser.add_argument("--output_dir",              type=str)
    parser.add_argument("--model_name",              type=str)
    parser.add_argument("--task",                    type=str, choices=["question_generation", "question_prediction"])
    parser.add_argument("--num_epochs",              type=int)
    parser.add_argument("--train_batch_size",        type=int)
    parser.add_argument("--learning_rate",           type=float)
    parser.add_argument("--use_fp16",                action="store_true", default=None)
    parser.add_argument("--resume_from_checkpoint",  type=str)
    args = parser.parse_args()

    cfg = CONFIG
    for k, v in vars(args).items():
        if v is not None:
            setattr(cfg, k, v)
    return cfg


if __name__ == "__main__":
    cfg = parse_args()
    train(cfg)
