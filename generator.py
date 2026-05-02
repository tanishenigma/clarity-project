import math
import os
import re
from collections import Counter

import ollama

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_HOST  = os.environ.get("OLLAMA_HOST",  "http://localhost:11434")

# Qwen2.5:4b has a 32k-token context window.
# We budget generously but stay well under the limit.
CONTEXT_CHAR_LIMIT = 12_000  # ~3 k tokens of context headroom


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
    Rank docs by BM25 relevance then greedily pack them up to CONTEXT_CHAR_LIMIT
    characters so Qwen's context window is never exceeded.
    """
    ranked = _rank_docs(query, docs)
    sep = "\n---\n"
    packed: list[str] = []
    total = 0

    for doc in ranked:
        doc = doc.strip()
        chunk = (sep + doc) if packed else doc
        if total + len(chunk) <= CONTEXT_CHAR_LIMIT:
            packed.append(doc)
            total += len(chunk)
        else:
            # Fit a truncated tail of the doc if there is room
            remaining = CONTEXT_CHAR_LIMIT - total - len(sep)
            if remaining > 120:
                packed.append(doc[:remaining])
            break

    return sep.join(packed)


def generate_answer(query: str, context: list[str]) -> str:
    if not context:
        print("[Ollama Generator] No context docs provided — generating from query only")
        context_str = ""
    else:
        context_str = _pack_context(query, context)
        print(f"[Ollama Generator] Packed {len(context)} docs into context "
              f"({len(context_str)} chars)")

    if context_str:
        prompt = (
            "You are a helpful assistant. Use ONLY the context below to answer "
            "the question. If the context does not contain enough information, "
            "say so clearly.\n\n"
            f"Context:\n{context_str}\n\n"
            f"Question: {query}\n\nAnswer:"
        )
    else:
        prompt = f"Answer the following question concisely.\n\nQuestion: {query}\n\nAnswer:"

    print(f"[Ollama Generator] Sending prompt to {OLLAMA_MODEL} via {OLLAMA_HOST}")

    client = ollama.Client(host=OLLAMA_HOST)
    response = client.generate(
        model=OLLAMA_MODEL,
        prompt=prompt,
        options={"temperature": 0.2, "num_predict": 512},
    )

    answer = response["response"].strip()
    print(f"[Ollama Generator] Raw output: {answer!r}")
    return answer