# T5-Large Fine-Tuning — JUIT Exam Question Generation & Prediction

Fine-tune **Google T5-Large** on the JUIT exam question dataset to:
1. **Generate exam questions** from course metadata (course name, department, CO, etc.)
2. **Predict question topics** given an existing question

---

## Project Structure

```
t5_finetune/
├── config.py          ← All hyperparameters & paths (edit this first)
├── data_utils.py      ← Data loading, cleaning, tokenization, Dataset class
├── prepare_data.py    ← Inspect + validate your dataset before training
├── train.py           ← Main training loop (run this to train)
├── inference.py       ← Generate questions / predict topics after training
├── requirements.txt   ← Python dependencies
└── README.md
```

---

## Quick Start

### 1. Install dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# Install PyTorch with CUDA (visit pytorch.org for your exact CUDA version)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install remaining deps
pip install -r requirements.txt
```

### 2. Set your data path

Edit **`config.py`** — change just this one line:
```python
data_path: str = "C:/path/to/your/questions.jsonl"  # ← your file here
```
Your file can be `.jsonl` (one JSON per line) or `.json` (list of objects).  
Each record must have at least `course_name` and `question_text` fields.

### 3. Inspect your data (optional but recommended)

```bash
python prepare_data.py --data_path C:/path/to/your/questions.jsonl
```
This prints dataset statistics (course distribution, question lengths, etc.)  
and warns you about any quality issues — no training happens here.

### 4. Train

```bash
python train.py
```

Or override any config value via CLI:
```bash
python train.py \
    --data_path C:/data/questions.jsonl \
    --num_epochs 15 \
    --train_batch_size 4 \
    --learning_rate 2e-4 \
    --task question_generation
```

Resume interrupted training:
```bash
python train.py --resume_from_checkpoint outputs/t5_large_exam/checkpoint-500
```

Training outputs saved to `outputs/t5_large_exam/`:
```
outputs/t5_large_exam/
├── best_model/          ← best checkpoint by val loss (use this for inference)
├── final_model/         ← last epoch model
├── checkpoint-500/      ← periodic checkpoints
└── logs/                ← TensorBoard logs
```

Monitor training in TensorBoard:
```bash
tensorboard --logdir outputs/logs
# Open http://localhost:6006 in your browser
```

### 5. Generate questions

```bash
# Generate 3 questions for Molecular Biology, CO4
python inference.py \
    --model_path outputs/t5_large_exam/best_model \
    --task question_generation \
    --course "Molecular Biology" \
    --department "BT" \
    --outcome "CO4"

# Generate a full mini question paper
python inference.py \
    --model_path outputs/t5_large_exam/best_model \
    --generate_paper \
    --course "Mechanics of Solids" \
    --department "Civil" \
    --outcomes "CO1,CO2,CO3,CO4,CO5"

# Interactive REPL (most convenient)
python inference.py \
    --model_path outputs/t5_large_exam/best_model \
    --interactive
```

---

## Configuration Reference (`config.py`)

| Parameter | Default | Notes |
|-----------|---------|-------|
| `data_path` | `data/questions.jsonl` | **Set this to your file path** |
| `model_name` | `google/t5-large` | Use `google/flan-t5-large` for better results |
| `task` | `question_generation` | or `question_prediction` |
| `num_epochs` | `10` | Increase to 15–20 for small datasets |
| `train_batch_size` | `4` | Reduce to `2` if you get OOM errors |
| `gradient_accumulation_steps` | `4` | Effective batch = 4×4 = 16 |
| `learning_rate` | `3e-4` | Good default for T5; try `1e-4` to `5e-4` |
| `use_fp16` | `True` | Set `False` for GPUs without fp16 support |
| `patience` | `5` | Early stopping patience (evaluations) |
| `eval_every_n_steps` | `200` | Evaluate val loss every N optimizer steps |
| `num_beams` | `4` | Beam search width at inference |

---

## GPU Memory Requirements

| Model | Batch Size | FP16 | Approx VRAM |
|-------|-----------|------|-------------|
| T5-Large | 4 | Yes | ~8 GB |
| T5-Large | 4 | No  | ~14 GB |
| T5-Large | 2 | Yes | ~5 GB |
| flan-t5-large | 4 | Yes | ~8 GB |

If you have **< 8 GB VRAM**: set `train_batch_size=2`, `gradient_accumulation_steps=8`

---

## Task Format

### question_generation
```
INPUT:  "generate question: course: Molecular Biology | department: BT |
         program: B.Tech | semester: EVEN SEMESTER | exam: T-3 | outcome: CO4"

OUTPUT: "Explain the gene regulation with respect to activation and repression
         of transcription using histone proteins."
```

### question_prediction
```
INPUT:  "predict next question topic: Explain the role of telomerase in cancer."

OUTPUT: "course: Molecular Biology | outcome: CO5 | exam: T-3"
```

---

## Tips for Best Results

1. **More data = better quality.** If you have < 500 samples, use `flan-t5-large` instead of `t5-large` — it has stronger priors.
2. **Augment data**: For each question, you can create variants by swapping department/semester metadata.
3. **Lower LR for small data**: Try `learning_rate=1e-4` with < 1000 samples.
4. **Check val loss curve**: If val loss stops improving but train loss keeps dropping, you're overfitting — increase `val_ratio` or reduce `num_epochs`.
