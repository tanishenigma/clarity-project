from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def correct_context(query, retrieved_docs, threshold=0.4):
    query_embedding = model.encode(query, convert_to_tensor=True)

    filtered = []
    scores = []

    for doc in retrieved_docs:
        doc_embedding = model.encode(doc, convert_to_tensor=True)
        score = util.cos_sim(query_embedding, doc_embedding).item()

        if score > threshold:
            filtered.append(doc)
            scores.append(score)

    # fallback (CRAG behavior)
    if len(filtered) == 0:
        return retrieved_docs[:2], 0.2  # low confidence

    confidence = sum(scores) / len(scores)

    return filtered, round(confidence, 2)