# Subscription Tracker (MVP Skeleton)

API-first starter for a subscription and recurring payments tracker using modern Python tooling.

## Tech Stack

- Python 3.12+
- FastAPI
- Pydantic v2
- `uv` for env + dependency management
- pytest
- ruff
- pyright

## MVP Scope (Current)

- Basic subscription CRUD (in-memory repository)
- Next charge date calculation for weekly/monthly/yearly cadence
- Health endpoint
- Starter tests

## Project Structure

```text
Subscription_tracker/
├── README.md
├── DEVELOPMENT_PROGRESS.md
├── pyproject.toml
├── ruff.toml
├── pyrightconfig.json
├── .env.example
├── scripts/
│   └── dev.sh
├── src/
│   └── subtracker_api/
│       ├── main.py
│       ├── api/
│       │   ├── deps.py
│       │   └── routes/
│       │       ├── health.py
│       │       └── subscriptions.py
│       ├── core/
│       │   └── config.py
│       ├── models/
│       │   └── subscription.py
│       ├── repositories/
│       │   └── memory_subscription_repo.py
│       └── services/
│           └── billing.py
└── tests/
    ├── conftest.py
    ├── test_health.py
    └── test_subscriptions.py
```

## Quick Start

### 1) Create venv

```bash
uv venv --python 3.12
source .venv/bin/activate
```

### 2) Install dependencies

```bash
uv sync --dev
```

### 3) Run API

```bash
uv run uvicorn subtracker_api.main:app --reload
```

Open `http://127.0.0.1:8000/docs`.

### 4) Run tests

```bash
uv run pytest
```

### 5) Lint + type check

```bash
uv run ruff check .
uv run pyright
```

## Environment Variables

Copy:

```bash
cp .env.example .env
```

Current MVP does not require external services; settings are prepared for expansion.

## Next Iterations

- Replace in-memory repository with PostgreSQL + SQLAlchemy + Alembic
- Add auth + multi-user workspaces
- Add notifications and insight scoring
- Add ingestion and vendor normalization

