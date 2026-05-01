import math
import os
import re
from collections import Counter

from transformers import T5ForConditionalGeneration, T5Tokenizer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "Model", "T5_FineTuned")

tokenizer = T5Tokenizer.from_pretrained(MODEL_PATH)

model = T5ForConditionalGeneration.from_pretrained(
    MODEL_PATH,
    use_safetensors=True,
)

# T5-Large has a hard positional limit of 512 tokens.
# Reserve ~80 tokens for the query + prefix, leaving ~430 for context.
MAX_INPUT_TOKENS = 512
QUERY_TOKEN_BUDGET = 80
CONTEXT_TOKEN_BUDGET = MAX_INPUT_TOKENS - QUERY_TOKEN_BUDGET


# ── BM25-lite scoring ─────────────────────────────────────────────────────────

def _tokenize(text: str):
    return re.findall(r"[a-z0-9]+", text.lower())


def _bm25_score(query_terms, doc_tokens, avg_doc_len, k1=1.5, b=0.75):
    """Lightweight BM25 for ranking docs without external dependencies."""
    tf = Counter(doc_tokens)
    doc_len = len(doc_tokens)
    score = 0.0
    for term in query_terms:
        f = tf.get(term, 0)
        if f == 0:
            continue
        idf = math.log(1 + 1 / (0.5 + 1))  # simplified IDF (single doc)
        numerator = f * (k1 + 1)
        denominator = f + k1 * (1 - b + b * doc_len / max(avg_doc_len, 1))
        score += idf * (numerator / denominator)
    return score


def _rank_docs(query: str, docs: list[str]) -> list[str]:
    """Return docs sorted by BM25 relevance to query (most relevant first)."""
    if not docs:
        return docs
    query_terms = _tokenize(query)
    tokenized_docs = [_tokenize(d) for d in docs]
    avg_len = sum(len(t) for t in tokenized_docs) / len(tokenized_docs)
    scored = [
        (_bm25_score(query_terms, tok, avg_len), doc)
        for tok, doc in zip(tokenized_docs, docs)
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [doc for _, doc in scored]


def _pack_context(query: str, docs: list[str]) -> str:
    """
    Tokenize each doc and greedily pack the most relevant ones into the
    available context budget so nothing gets silently truncated mid-sentence.
    """
    ranked = _rank_docs(query, docs)

    packed_tokens = []
    sep = " | "
    sep_ids = tokenizer.encode(sep, add_special_tokens=False)

    for doc in ranked:
        doc_ids = tokenizer.encode(doc.strip(), add_special_tokens=False)
        needed = len(doc_ids) + (len(sep_ids) if packed_tokens else 0)
        if len(packed_tokens) + needed <= CONTEXT_TOKEN_BUDGET:
            if packed_tokens:
                packed_tokens.extend(sep_ids)
            packed_tokens.extend(doc_ids)
        else:
            # Try to fit a truncated version of this doc
            remaining = CONTEXT_TOKEN_BUDGET - len(packed_tokens)
            if remaining > 30:
                if packed_tokens:
                    remaining -= len(sep_ids)
                    packed_tokens.extend(sep_ids)
                packed_tokens.extend(doc_ids[:remaining])
            break

    return tokenizer.decode(packed_tokens, skip_special_tokens=True)


def generate_answer(query: str, context: list[str]) -> str:
    if not context:
        print("[T5 Generator] No context docs provided — generating from query only")
        context_str = ""
    else:
        context_str = _pack_context(query, context)
        print(f"[T5 Generator] Packed {len(context)} docs into context "
              f"({len(tokenizer.encode(context_str))} tokens)")

    input_text = f"question: {query} context: {context_str}"

    # Encode without automatic truncation so we can log a warning if needed
    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
    )
    input_len = inputs["input_ids"].shape[1]
    if input_len >= MAX_INPUT_TOKENS:
        print(f"[T5 Generator] WARNING: input hit max token limit ({MAX_INPUT_TOKENS}), "
              "context may still be truncated — consider shorter docs")
    else:
        print(f"[T5 Generator] Input length: {input_len} / {MAX_INPUT_TOKENS} tokens")

    outputs = model.generate(
        **inputs,
        max_new_tokens=256,       # cap *new* tokens, not total length
        num_beams=4,
        no_repeat_ngram_size=3,   # prevents repetitive loops
        length_penalty=1.2,       # slightly favour longer, more complete answers
        early_stopping=True,
    )

    answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
    print(f"[T5 Generator] Raw output: {answer!r}")
    return answer