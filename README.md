# Clarity Project

Clarity is an AI-powered study platform that combines a Next.js application, a MongoDB data layer, and a Python-based CRAG service to support tutoring, notes, flashcards, quizzes, study analytics, and content-driven learning spaces.

The codebase is now organized so that frontend code, backend runtime code, and ML training assets each have clear ownership:

- Next.js app and API routes live at the root application level.
- Python CRAG runtime lives under `services/backend`.
- Model training code and fine-tuned assets live under `services/ml`.

## What The Project Does

- AI tutoring with contextual answers based on uploaded learning content
- Learning spaces for grouping notes, files, and study materials
- Notes, summaries, flashcards, and quizzes generated from content
- Study timers and analytics for progress tracking
- YouTube and document analysis workflows
- A local CRAG backend for generation and optional standalone retrieval endpoints

## Architecture

Clarity is split into three main layers:

1. `app/` and `components/`
   The Next.js 16 frontend and route handlers. This is the main product surface.

2. `lib/`
   Shared TypeScript logic such as database access, AI client configuration, service orchestration, and the TypeScript CRAG graph used by the app.

3. `services/`
   Python services and ML artifacts.
   - `services/backend/` contains the Flask runtime that powers local CRAG endpoints.
   - `services/ml/` contains training utilities and fine-tuned T5 model assets.

At runtime, the frontend uses TypeScript retrieval and orchestration logic from `lib/crag/`, then sends generation requests to the Flask service configured through `CRAG_FLASK_URL`.

## High-Level Flow

1. A user asks a question in the Next.js app.
2. The app resolves user context, space context, and uploaded content.
3. `lib/crag/` retrieves and grades relevant content.
4. The app calls the Flask service at `services/backend/app.py` for local generation.
5. The generated answer is optionally polished by the configured AI provider and returned to the UI.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI
- Framer Motion
- React PDF
- KaTeX

### Backend And Data

- Next.js Route Handlers under `app/api/`
- MongoDB with Mongoose
- Flask for local CRAG endpoints
- Ollama for local generation

### AI And ML

- Gemini, Groq, and Euri provider support through the TypeScript AI client
- LangChain and LangGraph for orchestration
- Sentence Transformers and FAISS for legacy Python retrieval
- T5 fine-tuning utilities under `services/ml/`

## Project Structure

```text
crag/
├── app/                         # Next.js App Router pages and API route handlers
├── components/                  # UI primitives and feature-specific React components
├── data/                        # Local datasets and optional legacy corpora
├── lib/                         # Shared TS services, agents, models, utils, CRAG graph
├── middleware.ts                # Next.js auth middleware entrypoint
├── public/                      # Static assets
├── services/
│   ├── backend/
│   │   ├── app.py               # Flask entrypoint for CRAG endpoints
│   │   ├── requirements.txt     # Python runtime dependencies for backend service
│   │   └── crag/
│   │       ├── corrector.py
│   │       ├── generator.py
│   │       └── retriever.py
│   └── ml/
│       ├── hf_auth.py           # Hugging Face token helper
│       ├── requirements.txt     # Python dependencies for training
│       ├── train.py             # T5 fine-tuning entrypoint
│       └── models/
│           └── T5_FineTuned/    # Fine-tuned model artifacts
├── .env.example                 # Environment variable template
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## Important Directories

### `app/`

Contains the Next.js App Router structure.

- `app/(app)/` contains the authenticated app experience.
- `app/auth/` contains auth screens.
- `app/api/` contains Next.js route handlers for product APIs.

### `components/`

Contains UI and feature components.

- `components/ui/` for reusable UI primitives
- `components/chat-components/` for tutor/chat UI
- `components/notes-components/` for notes workflows
- `components/spaces-components/` for learning space features
- `components/layout/` for application shell components

### `lib/`

Contains the shared TypeScript application layer.

- `lib/db.ts` for MongoDB connection logic
- `lib/models/` for Mongoose models
- `lib/services/` for business logic
- `lib/agents/` for AI agents and orchestration
- `lib/crag/` for the TypeScript CRAG graph used by the frontend

### `services/backend/`

Contains the Python Flask backend used for local CRAG generation and optional standalone endpoints:

- `POST /api/query`
- `POST /api/retrieve`
- `POST /api/correct`
- `POST /api/generate`
- `POST /api/flashcards`

### `services/ml/`

Contains training code and model artifacts.

- `train.py` fine-tunes the local T5 model
- `models/T5_FineTuned/` stores model weights and tokenizer files

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need.

### Required Core Variables

```bash
MONGODB_URI=
JWT_SECRET=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRAG_FLASK_URL=http://localhost:5001
```

### AI Provider Variables

```bash
AI_MODEL=gemini-2.5-flash-lite
AI_VISION_MODEL=gemini-2.5-flash-lite
GOOGLE_API_KEY=
GROQ_API_KEY=
EURI_API_KEY=
```

### Upload And Media Variables

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
UPLOADTHING_TOKEN=
```

### Local CRAG Variables

```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
TAVILY_API_KEY=
```

## Prerequisites

Before running the project locally, make sure you have:

- Node.js 18 or newer
- npm
- Python 3.10 or newer
- MongoDB running locally or a hosted MongoDB connection string
- Ollama installed if you want to run local CRAG generation

## Setup

### 1. Install Node Dependencies

```bash
npm install
```

### 2. Create And Activate A Python Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Backend Python Dependencies

```bash
pip install -r services/backend/requirements.txt
```

### 4. Install ML Training Dependencies

```bash
pip install -r services/ml/requirements.txt
```

### 5. Configure Environment Variables

```bash
cp .env.example .env
```

Update `.env` with your MongoDB URI, auth secrets, and any AI provider keys you want to use.

## Development Workflows

### Full Stack Development

Runs the Next.js app and Flask backend together.

```bash
npm run dev
```

This starts:

- `npm run dev:web`
- `npm run dev:backend`

### Frontend Only

```bash
npm run dev:web
```

### Backend Only

```bash
npm run flask
```

Or directly:

```bash
python3 services/backend/app.py
```

### Production Build

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## ML Training Workflow

The T5 training entrypoint is now:

```bash
npm run train:model
```

Or directly:

```bash
python3 services/ml/train.py
```

### Training Inputs

- Optional custom QA file: `data/custom_qa.jsonl`
- Fine-tuned model output: `services/ml/models/T5_FineTuned/`

### Notes About Training

- `data/custom_qa.jsonl` is optional.
- If the file is absent, the training script falls back to SQuAD examples.
- Training dependencies are intentionally isolated from the backend runtime dependencies.

## API Overview

### Next.js Route Domains

The main application APIs live under `app/api/` and include domains such as:

- `app/api/auth/`
- `app/api/chat/`
- `app/api/content/`
- `app/api/conversations/`
- `app/api/dashboard/`
- `app/api/flashcards/`
- `app/api/learning/`
- `app/api/notes/`
- `app/api/podcasts/`
- `app/api/quizzes/`
- `app/api/settings/`
- `app/api/spaces/`
- `app/api/study-timer/`
- `app/api/youtube/`

### Flask CRAG Endpoints

The Python backend exposes local endpoints for standalone CRAG behavior:

```text
POST /api/query
POST /api/retrieve
POST /api/correct
POST /api/generate
POST /api/flashcards
```

## Data And Content Notes

The current application primarily retrieves content from MongoDB-backed user content through the TypeScript CRAG pipeline.

The Python retriever also supports a legacy local corpus file:

```text
data/notes.txt
```

If that file is missing, the backend starts cleanly and retrieval endpoints simply return no legacy local documents. This is intentional so the main application flow remains usable even without the old file-based corpus.

## Middleware

The auth redirect middleware now uses the standard Next.js entrypoint:

```text
middleware.ts
```

This keeps auth behavior aligned with Next.js conventions and avoids the older non-standard `proxy.ts` entrypoint name.

## Recommended Development Conventions

- Keep React UI work inside `app/`, `components/`, and `lib/`.
- Keep Python backend runtime logic inside `services/backend/`.
- Keep training utilities and model artifacts inside `services/ml/`.
- Keep route handlers thin and move business logic into `lib/services/`.
- Prefer `@/` imports for frontend and shared TypeScript code.

## Troubleshooting

### Old UI Still Appears After Edits

If the browser still shows old UI after code changes:

```bash
rm -rf .next
npm run dev
```

Then hard refresh the browser.

### Flask Service Fails To Start

Make sure backend dependencies are installed:

```bash
pip install -r services/backend/requirements.txt
```

### Training Fails Because Packages Are Missing

Install the ML dependencies separately:

```bash
pip install -r services/ml/requirements.txt
```

### Ollama Generation Is Not Working

Check that:

- Ollama is installed and running
- `OLLAMA_HOST` points to the right server
- `OLLAMA_MODEL` is available locally
- `CRAG_FLASK_URL` matches the Flask service address

### Legacy Retrieval Returns No Documents

This is expected if `data/notes.txt` is not present. The main app still uses the TypeScript and MongoDB-backed retrieval pipeline.

## Contribution Guide

When contributing:

1. Keep structural ownership clear.
2. Update documentation when moving files or changing runtime commands.
3. Avoid mixing Python service code into the Next.js root again.
4. Prefer feature-specific folders over unrelated root-level files.
5. Validate frontend and backend changes independently before combining them.

## Suggested Next Improvements

The current structure is intentionally conservative. Good follow-up improvements would be:

1. Consolidate scattered component files into `components/shared/` and feature-specific folders.
2. Add dedicated backend and ML test commands.
3. Introduce Docker support for the Flask and Ollama stack.
4. Add typed API contracts for key `app/api/` routes.

## Summary

Clarity now has a cleaner separation between:

- product UI and route handlers
- shared TypeScript logic
- Python CRAG runtime
- model training assets

That separation makes the project easier to onboard onto, easier to extend, and easier to deploy in a more professional way.