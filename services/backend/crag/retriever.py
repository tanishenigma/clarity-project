from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

# load embedding model
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# load notes
REPO_ROOT = Path(__file__).resolve().parents[3]
NOTES_FILE = REPO_ROOT / "data" / "notes.txt"

if NOTES_FILE.exists():
    with NOTES_FILE.open('r', encoding='utf-8') as f:
        documents = [line for line in f.readlines() if line.strip()]
else:
    print(f"[Retriever] Notes file not found at {NOTES_FILE}; starting with empty corpus")
    documents = []

# embeddings
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension
index = faiss.IndexFlatL2(EMBEDDING_DIM)

if documents:
    doc_embeddings = model.encode(documents)
    index.add(np.array(doc_embeddings))

def retrieve(query, k=5):
    if index.ntotal == 0:
        return []
    query_embedding = model.encode([query])
    k = min(k, index.ntotal)
    distances, indices = index.search(np.array(query_embedding), k)

    results = [documents[i] for i in indices[0]]
    return results