"""
data_utils.py
=============
Data loading, cleaning, tokenization, and Dataset utilities for T5 fine-tuning.
"""

import json
import re
from pathlib import Path
from typing import List, Tuple, Dict, Any
import random

import torch
from torch.utils.data import Dataset
from transformers import T5Tokenizer


def clean_text(text: str) -> str:
    """Clean and normalize text."""
    if not text:
        return ""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep basic punctuation
    text = re.sub(r'[^\w\s\.\,\?\!\-\(\):]', '', text)
    return text.strip()


def load_dataset_from_path(data_path: str) -> List[Dict[str, Any]]:
    """
    Load dataset from .jsonl or .json file.
    Each record should have at least 'course_name' and 'question_text' fields.
    """
    records = []
    path = Path(data_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {data_path}")
    
    if path.suffix == ".jsonl":
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    elif path.suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                records = data
            else:
                records = [data]
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")
    
    return records


def records_to_pairs(
    records: List[Dict[str, Any]],
    task: str = "question_generation"
) -> List[Tuple[str, str]]:
    """
    Convert records to (input, target) pairs.
    
    Args:
        records: List of exam question records
        task: Either "question_generation" or "question_prediction"
              - question_generation: input=metadata, target=question
              - question_prediction: input=question, target=topic/co
    
    Returns:
        List of (input_text, target_text) tuples
    """
    pairs = []
    
    for record in records:
        question_text = record.get("question_text", "").strip()
        
        # Skip empty questions
        if not question_text:
            continue
        
        if task == "question_generation":
            # Input: course metadata → Output: question
            course = record.get("course_name", "Unknown")
            dept = (record.get("departments") or ["Unknown"])[0]
            semester = record.get("semester", "Unknown")
            exam_type = record.get("exam_type", "Unknown")
            co = record.get("co", "")
            
            # Construct input prompt
            inp = f"course: {course} | department: {dept} | semester: {semester} | exam: {exam_type}"
            if co:
                inp += f" | CO: {co}"
            
            tgt = question_text
            pairs.append((inp, tgt))
        
        elif task == "question_prediction":
            # Input: question → Output: next topic/CO/summary
            inp = question_text
            
            # Try to use CO, fallback to course
            tgt = record.get("co", "")
            if not tgt:
                tgt = record.get("course_name", "General")
            
            if tgt:
                pairs.append((inp, tgt))
    
    return pairs


def split_pairs(
    pairs: List[Tuple[str, str]],
    val_ratio: float = 0.1,
    seed: int = 42
) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
    """
    Split (input, target) pairs into train and validation sets.
    """
    random.seed(seed)
    random.shuffle(pairs)
    
    split_idx = int(len(pairs) * (1 - val_ratio))
    train_pairs = pairs[:split_idx]
    val_pairs = pairs[split_idx:]
    
    return train_pairs, val_pairs


class ExamQuestionsDataset(Dataset):
    """PyTorch Dataset for exam question pairs."""
    
    def __init__(
        self,
        pairs: List[Tuple[str, str]],
        tokenizer: T5Tokenizer,
        max_input_len: int = 256,
        max_target_len: int = 256,
    ):
        self.pairs = pairs
        self.tokenizer = tokenizer
        self.max_input_len = max_input_len
        self.max_target_len = max_target_len
    
    def __len__(self):
        return len(self.pairs)
    
    def __getitem__(self, idx):
        inp_text, tgt_text = self.pairs[idx]
        
        # Encode input
        inp_encoded = self.tokenizer(
            inp_text,
            max_length=self.max_input_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        
        # Encode target
        tgt_encoded = self.tokenizer(
            tgt_text,
            max_length=self.max_target_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        
        # T5 expects labels to replace -100 for padding tokens
        labels = tgt_encoded["input_ids"].clone()
        labels[labels == self.tokenizer.pad_token_id] = -100
        
        return {
            "input_ids": inp_encoded["input_ids"].squeeze(),
            "attention_mask": inp_encoded["attention_mask"].squeeze(),
            "labels": labels.squeeze(),
        }


def build_datasets(
    data_path: str,
    tokenizer: T5Tokenizer,
    task: str = "question_generation",
    max_input_len: int = 256,
    max_target_len: int = 256,
    val_ratio: float = 0.1,
) -> Tuple[ExamQuestionsDataset, ExamQuestionsDataset]:
    """
    Complete pipeline: load data → convert to pairs → split → create datasets.
    
    Returns:
        (train_dataset, val_dataset)
    """
    # Load records
    records = load_dataset_from_path(data_path)
    
    # Convert to pairs
    pairs = records_to_pairs(records, task=task)
    
    # Split
    train_pairs, val_pairs = split_pairs(pairs, val_ratio=val_ratio)
    
    # Create datasets
    train_ds = ExamQuestionsDataset(
        train_pairs,
        tokenizer,
        max_input_len=max_input_len,
        max_target_len=max_target_len,
    )
    
    val_ds = ExamQuestionsDataset(
        val_pairs,
        tokenizer,
        max_input_len=max_input_len,
        max_target_len=max_target_len,
    )
    
    return train_ds, val_ds
