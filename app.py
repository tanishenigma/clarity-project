from flask import Flask, jsonify, request

from corrector import correct_context
from generator import generate_answer
from retriever import retrieve

app = Flask(__name__)


# ── JSON API ──────────────────────────────────────────────────────────────────

@app.route('/api/query', methods=['POST'])
def api_query():
    """Full CRAG pipeline: retrieve -> correct -> generate.

    Request JSON:
        { "query": "...", "docs": ["optional pre-fetched docs"] }

    Response JSON:
        { "answer": "...", "confidence": 0.0-1.0, "sources": ["..."] }
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'query is required'}), 400

    external_docs = data.get('docs')  # optional docs from TypeScript retriever

    if external_docs:
        raw_docs = external_docs
    else:
        raw_docs = retrieve(query)

    corrected_docs, confidence = correct_context(query, raw_docs)
    answer = generate_answer(query, corrected_docs)

    return jsonify({
        'answer': answer,
        'confidence': confidence,
        'sources': corrected_docs,
    })


@app.route('/api/generate', methods=['POST'])
def api_generate():
    """Generation-only endpoint (caller handles retrieve + correct).

    Request JSON:
        { "query": "...", "docs": ["..."] }

    Response JSON:
        { "answer": "..." }
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get('query', '').strip()
    docs  = data.get('docs', [])

    if not query:
        return jsonify({'error': 'query is required'}), 400

    answer = generate_answer(query, docs)
    return jsonify({'answer': answer})


@app.route('/api/retrieve', methods=['POST'])
def api_retrieve():
    """Retrieval-only endpoint.

    Request JSON:
        { "query": "...", "k": 5 }

    Response JSON:
        { "docs": ["..."] }
    """
    data = request.get_json(force=True, silent=True) or {}
    query = data.get('query', '').strip()
    k     = int(data.get('k', 5))

    if not query:
        return jsonify({'error': 'query is required'}), 400

    docs = retrieve(query, k=k)
    return jsonify({'docs': docs})


@app.route('/api/correct', methods=['POST'])
def api_correct():
    """Correction-only endpoint.

    Request JSON:
        { "query": "...", "docs": ["..."], "threshold": 0.4 }

    Response JSON:
        { "docs": ["..."], "confidence": 0.0-1.0 }
    """
    data = request.get_json(force=True, silent=True) or {}
    query     = data.get('query', '').strip()
    docs      = data.get('docs', [])
    threshold = float(data.get('threshold', 0.4))

    if not query:
        return jsonify({'error': 'query is required'}), 400

    corrected, confidence = correct_context(query, docs, threshold=threshold)
    return jsonify({'docs': corrected, 'confidence': confidence})


# ── HTML UI (kept for standalone testing) ─────────────────────────────────────

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        query = request.form.get('query')

        # CRAG pipeline
        docs = retrieve(query)
        corrected_docs, confidence = correct_context(query, docs)
        answer = generate_answer(query, corrected_docs)

        return f"""
        <h2>CRAG AI Tutor</h2>
        <p><b>Question:</b> {query}</p>
        <p><b>Answer:</b> {answer}</p>
        <p><b>Confidence:</b> {confidence}</p>
        <br><a href="/">Ask another</a>
        """

    return '''
    <h2>CRAG AI Tutor</h2>
    <form method="post">
        <input name="query" placeholder="Ask something" style="width:300px;">
        <button type="submit">Ask</button>
    </form>
    '''


@app.route('/api/flashcards', methods=['POST'])
def api_flashcards():
    """Generate flashcards from content text using the local T5 model.

    Request JSON:
        { "text": "...", "numCards": 10, "difficulty": "medium" }

    Response JSON:
        { "flashcards": [{"question": "...", "answer": "..."}, ...] }
    """
    import re

    data = request.get_json(force=True, silent=True) or {}
    text = data.get('text', '').strip()
    num_cards = int(data.get('numCards', 10))

    if not text:
        return jsonify({'error': 'text is required'}), 400

    # Split into sentences and filter short ones
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 40]

    if not sentences:
        return jsonify({'flashcards': []})

    # Pick evenly spaced sentences up to num_cards
    step = max(1, len(sentences) // num_cards)
    selected = sentences[::step][:num_cards]

    flashcards = []
    for sent in selected:
        # Extract a key phrase (first 5 words) to form the question
        words = sent.split()
        key_phrase = ' '.join(words[:min(5, len(words))])

        # Ask T5 to answer a question about this sentence
        question_prompt = f"{key_phrase}?"
        t5_answer = generate_answer(question_prompt, [sent])

        flashcards.append({
            'question': question_prompt,
            'answer': t5_answer if t5_answer and len(t5_answer) > 5 else sent,
        })

    return jsonify({'flashcards': flashcards})


if __name__ == '__main__':
    app.run(debug=True, port=5001)
