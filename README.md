<div align="center">
  <img src="frontend/public/lottoscope.svg" width="56" height="56" alt="LottoScope logo" />
  <h1>LottoScope</h1>
  <p><strong>Historical Vietlott draw archive, statistical analytics, combination checker, and 3D physics draw simulator</strong></p>
  <p>
    <a href="https://lottoscope-sable.vercel.app">Live Demo</a> •
    <a href="#api-reference">API Reference</a> •
    <a href="#system-architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#deployment">Deployment</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python 3.12" />
    <img src="https://img.shields.io/badge/FastAPI-0.142-009688?logo=fastapi&logoColor=white" alt="FastAPI 0.142" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" alt="React 19" />
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
    <img src="https://img.shields.io/badge/Three.js_%2B_Rapier-3D_Physics-102B36" alt="Three.js and Rapier" />
  </p>
</div>

![LottoScope Dashboard Overview](assets/screenshots/dashboard.png)

---

## Overview

**LottoScope** is a full-stack web application for archiving, auditing, and analyzing historical **Vietlott** lottery draws across **Lotto 5/35** (`01–35` + special `01–12`), **Mega 6/45** (`01–45`), and **Power 6/55** (`01–55` + special `01–55`).

Official lottery pages publish draws one result at a time without aggregated frequencies, gap tracking, pair co-occurrence tables, or combination overlap history. LottoScope stores verified historical records in PostgreSQL and provides deterministic descriptive analytics alongside a local 3D physics draw simulator.

> [!NOTE]
> **Historical Analysis Scope Only:** LottoScope computes descriptive statistics strictly from recorded draws. It does **not** predict future outcomes, assign winning probabilities or opaque scores, automate ticket purchases, or claim financial returns.

---

## Key Features

### Implemented Features

- **Multi-Game Overview Dashboard** (`/dashboard`): Displays the latest recorded draw, top main-number frequencies, top co-occurring pairs, and dedicated Lotto 5/35 special-number (`01–12`) metrics within configurable windows (`last_draws`: `10`, `20`, `30`, `50`, `100`; `date_range`; or `all_time`).
- **Audited Draw History & Prize Tiers** (`/history`, `/history/:drawId`): Paginated draw archive sortable chronologically with per-draw prize breakdown tables ingested alongside results or fetched lazily on first visit and persisted in PostgreSQL.
- **Number & Pair Analytics** (`/numbers`, `/numbers/:number`, `/pairs`, `/pairs/:pair`): Independent main-number and Lotto 5/35 special-number frequencies, dense ranking, current/average/maximum appearance gaps, and canonical pair co-occurrence statistics with exact `as_of_draw_id` cutoff support.
- **Combination History Checker** (`/checker`): Validates a candidate main-number set against all historical draws up to an optional cutoff, reporting exact-match counts, a full overlap distribution histogram (`0` to `5`/`6` matches), matching draw records, and window-scoped number/pair metrics.
- **3D Physical Draw Simulator** (`/generator`): Client-side interactive draw drum powered by Three.js, React Three Fiber, and Rapier3D physics. Features a spherical glass drum, Z-axis 3-blade Y-rotor, 6-o'clock bottom discharge gate, dual-wing catch tray, distinct Lotto 5/35 red special-ball chamber (`01–12`) and enlarged `+50%` balls, reduced-motion mode, clipboard export, and one-click deep linking into Checker.
- **Idempotent Ingestion & Opt-In Publisher Fallback**: CLI importers, scheduled/manual sync (`POST /api/v1/games/{game}/sync` with 60s per-game cooldown), PostgreSQL session advisory locks, source provenance (`source_url`, `source_sha256`), discrepancy tracking (`draw_corrections`), and optional fallback to vetted community publishers when upstream returns anti-bot challenges.
- **AI & Crawler Access Layer**: Public [`robots.txt`](frontend/public/robots.txt) and [`llms.txt`](frontend/public/llms.txt), Edge-cached SSR data pages (`/data`, `/data/{game}`) supporting HTML, Markdown (`?format=md`), and RFC-4180 CSV (`?format=csv`), Vercel Edge Middleware auto-routing for AI crawlers, and 8 read-only client-side **WebMCP** tools (`document.modelContext`).

---

## Product Preview

|            Number Frequency & Gaps (`Lotto 5/35`)            |                Combination Checker (`Mega 6/45`)                 |
| :----------------------------------------------------------: | :--------------------------------------------------------------: |
| ![Lotto 5/35 Frequency Grid](assets/screenshots/numbers.png) | ![Mega 6/45 Combination Checker](assets/screenshots/checker.png) |

|           3D Draw Simulator (`Lotto 5/35` Special Chamber)           |                                    Mobile Dashboard (`390×844`)                                     |
| :------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------: |
| ![Lotto 5/35 3D Draw Simulator](assets/screenshots/draw-machine.png) | <img src="assets/screenshots/mobile-dashboard.png" width="280" alt="LottoScope Mobile Dashboard" /> |

---

## Technology Stack

| Layer                 | Technologies                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**          | React `19.2`, TypeScript `6.0`, Vite `8.3`, React Router `7.18`, `lucide-react`                                                                     |
| **3D Simulation**     | Three.js `0.186`, `@react-three/fiber` `9.8`, `@react-three/rapier` `2.2`, `@dimforge/rapier3d-compat` `0.19`                                       |
| **Backend**           | Python `3.12`, FastAPI `0.142`, Pydantic `2.13` / `pydantic-settings`, SQLAlchemy `2.1`, Alembic `1.20`, APScheduler `3.11`, `httpx`, Uvicorn, `uv` |
| **Database**          | PostgreSQL `16` (local Docker container / Neon Serverless Postgres in free cloud)                                                                   |
| **Edge & Hosting**    | Nginx `1.28-alpine` (Docker Compose), Vercel (Static SPA, Edge Middleware, Serverless API Gateway & `/data` SSR), Render Free Web Service           |
| **Testing & Quality** | `pytest`, `pyright`, `ruff`, `vitest`, `playwright`, `@axe-core/playwright`, `oxlint`, `prettier`                                                   |

---

## System Architecture

LottoScope runs identically as a local 3-container Docker Compose stack or a zero-cost cloud deployment (`Vercel` + `Render` + `Neon`):

```mermaid
flowchart LR
    Browser["Browser Client - React SPA, 3D Rapier, WebMCP"]
    Agents["AI Crawlers and Agents"]

    subgraph Edge["Frontend and Gateway Layer"]
        Nginx["Docker: Nginx 8088 - Static SPA and /api proxy"]
        Vercel["Cloud: Vercel Edge and Node - /api/gateway and /api/data SSR"]
    end

    subgraph API["Backend Modular Monolith - FastAPI 8000"]
        Routes["HTTP Routes - /health and /api/v1"]
        Services["Application Services - analytics, checker, generator, sync"]
        Ingestion["Ingestion Pipeline - httpx, parsers, advisory locks"]
    end

    DB[("PostgreSQL 16 - Docker / Neon")]
    Upstream["Vietlott Official Pages and Opt-in Community Fallback"]

    Browser -->|Local HTTP| Nginx
    Browser -->|HTTPS| Vercel
    Agents -->|"/data md/csv and /llms.txt"| Vercel

    Nginx -->|"/api/*"| Routes
    Vercel -->|X-Lotto-Origin-Token| Routes

    Routes --> Services
    Services --> DB
    Ingestion --> DB
    Ingestion --> Upstream
```

### Design Boundaries

- **Single Source of Truth**: PostgreSQL stores canonical draws (`draws`), tier payouts (`draw_prizes`), ingestion runs/items (`ingestion_runs`, `ingestion_items`), and detected upstream edits (`draw_corrections`).
- **Route/Domain Separation**: FastAPI routes handle only HTTP validation and status mapping; deterministic domain rules (`app/games/`, `app/domain/`), analytics (`app/analytics/`), and transactional workflows (`app/services/`) contain no framework coupling.
- **Origin Protection in Cloud Mode**: Setting `LOTTO_DEPLOYMENT_MODE=cloud` disables public OpenAPI docs and requires `X-Lotto-Origin-Token` on all routes except `/health/live`, enforced between Vercel's server-side gateway ([`frontend/api/gateway.ts`](frontend/api/gateway.ts)) and Render.

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** (recommended quickstart)
- Optional for host development: **Python 3.12** + [`uv`](https://docs.astral.sh/uv/), **Node.js 22.12+**, and **PostgreSQL 16**

### Quickstart with Docker Compose

1. **Clone the repository and create your local `.env` file:**

   ```bash
   git clone https://github.com/anhkhuong04/LottoScope.git
   cd LottoScope
   cp .env.example .env
   ```

   <details>
   <summary>Environment variables in <code>.env.example</code></summary>

   | Variable                  | Default                                                      | Description                                                                   |
   | ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
   | `POSTGRES_DB`             | `lotto`                                                      | Application PostgreSQL database name                                          |
   | `POSTGRES_USER`           | `lotto`                                                      | PostgreSQL role name                                                          |
   | `POSTGRES_PASSWORD`       | `lotto`                                                      | PostgreSQL password (change for non-dev environments)                         |
   | `LOTTO_DATABASE_URL`      | `postgresql+psycopg://lotto:lotto@127.0.0.1:5432/lotto`      | Host CLI / app DB URL (`compose.yaml` injects `@postgres:5432` inside Docker) |
   | `LOTTO_TEST_DATABASE_URL` | `postgresql+psycopg://lotto:lotto@127.0.0.1:5432/lotto_test` | Dedicated test DB URL (tables are truncated during integration tests)         |
   | `LOTTO_SCHEDULER_ENABLED` | `false`                                                      | Enables/disables background APScheduler collection                            |
   | `FRONTEND_PORT`           | `8088`                                                       | Host port exposed by the Nginx frontend container                             |

   </details>

2. **Build and start PostgreSQL, FastAPI backend, and Nginx frontend:**

   ```bash
   docker compose up -d --build --wait
   ```

3. **Apply database schema migrations explicitly:**

   ```bash
   docker compose exec backend alembic upgrade head
   ```

4. **Import initial draw history for all three games (idempotent, rate-limited at 1 req/s):**

   ```bash
   docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game lotto_535
   docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game mega_645
   docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game power_655
   ```

5. **Open the application:**
   - Web UI: `http://127.0.0.1:8088`
   - Backend readiness check: `http://127.0.0.1:8000/health/ready`
   - Interactive OpenAPI docs (local mode only): `http://127.0.0.1:8000/docs`

### Local Development (Without App Containers)

Run PostgreSQL via Docker (`docker compose up -d postgres --wait`), then launch the backend and Vite dev server directly:

```bash
# Terminal 1 — Backend
cd backend
uv sync --locked
uv run --locked alembic upgrade head
uv run --locked uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (proxies /api/* to http://127.0.0.1:8000; override via LOTTO_DEV_API_ORIGIN)
cd frontend
npm ci
npm run dev
```

To build the frontend production bundle:

```bash
cd frontend
npm run build
```

---

## Usage

### Web Routes

| Route                           | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `/dashboard`                    | Game overview, latest draw, top number frequencies, and top pairs                  |
| `/history` & `/history/:drawId` | Paginated draw history with date/ID filters and prize breakdown tables             |
| `/numbers` & `/numbers/:number` | Complete frequency/gap grid or table and individual number appearance logs         |
| `/pairs` & `/pairs/:pair`       | Co-occurring main-number pairs with filtering, sorting, and shared draw log        |
| `/checker`                      | Historical overlap checker for custom main-number combinations                     |
| `/generator`                    | Interactive 3D Rapier physics draw simulator (`/generator/preview` redirects here) |

### Data Operations CLI

Run ingestion, verification, and status inspection via `backend` module commands (or inside Docker with `docker compose run --rm --no-deps ...`):

```bash
# Audit imported IDs against official sources
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game mega_645

# Poll latest draws + reconcile recent 7 draws
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game lotto_535

# Inspect ingestion checkpoints and status
docker compose run --rm --no-deps backend python -m app.commands.ingestion_status
```

Additional maintenance CLIs (`sync_games`, `apply_correction`, `import_power_file`) are located under `backend/app/commands/`.

### AI-Readable Static Data Endpoints

When hosted via Vercel (or tested locally with the serverless handlers), read-only data views are exposed without client-side JavaScript:

```bash
curl "https://lottoscope-sable.vercel.app/data?format=md"
curl "https://lottoscope-sable.vercel.app/data/lotto_535?window=last_draws&count=50&format=csv&section=draws"
```

Supported query parameters: `window` (`last_draws` | `date_range` | `all_time`), `count` (`10|20|30|50|100`), `from_date`, `to_date`, `as_of_draw_id`, `draw_limit`, `draw_page`, `draw_sort`, `pair_limit`, `pair_page`, `format` (`html|md|csv`), and `section` (`draws|numbers|special|pairs`).

---

## Project Structure

```text
.
├── assets/screenshots/         # Product screenshots displayed in this README
├── backend/
│   ├── app/
│   │   ├── analytics/          # Pure statistical metrics and service orchestration
│   │   ├── api/                # FastAPI routers (/v1, /health) and origin-token ingress guard
│   │   ├── commands/           # CLI entrypoints (serve, collect, import_history, audit_import, sync_games)
│   │   ├── core/               # Typed Pydantic settings (database, ingress, scheduler)
│   │   ├── db/                 # SQLAlchemy engine, base metadata, and session management
│   │   ├── domain/             # Game-agnostic domain validation models (draws, prizes)
│   │   ├── games/              # Canonical definitions for lotto_535, mega_645, power_655
│   │   ├── ingestion/          # Vietlott HTML parsers, community fallback, retry/throttle, audit
│   │   ├── jobs/               # Scheduled collection triggers guarded by advisory locks
│   │   ├── models/             # ORM models matching Alembic schema
│   │   ├── repositories/       # PostgreSQL query/persistence layer
│   │   ├── schemas/            # Strict Pydantic v1 request/response contracts
│   │   └── services/           # Application use cases (checker, generator, history, prizes, sync)
│   ├── migrations/versions/    # Explicit Alembic migrations (0001..0005)
│   ├── tests/                  # Unit and PostgreSQL integration tests
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── api/                    # Vercel serverless handlers (/api/gateway, /api/data)
│   ├── public/                 # Static branding icons, robots.txt, and llms.txt
│   ├── server/                 # SSR HTML/Markdown/CSV builder and proxy validation
│   ├── src/
│   │   ├── features/
│   │   │   ├── draw-machine/   # Three.js / R3F / Rapier3D physics draw drum & controller
│   │   │   └── webmcp/         # Client-side WebMCP read-only tool registration
│   │   ├── pages/              # Dashboard, History, DrawPrizes, Numbers, Pairs, Checker, Generator
│   │   ├── api.ts, state.tsx, ui.tsx, App.tsx
│   ├── tests/                  # Vitest unit tests and Playwright E2E + Axe accessibility tests
│   ├── middleware.ts           # Edge middleware routing AI crawlers to /api/data
│   ├── nginx.conf & Dockerfile # Production Nginx SPA + reverse proxy image
│   └── vercel.json
├── scripts/                    # Cloud smoke checks and optional Windows local sync scripts
├── compose.yaml                # Local PostgreSQL + FastAPI + Nginx stack
├── compose.lan.yaml            # Opt-in Wi-Fi LAN frontend binding overlay
└── render.yaml                 # Render Free Blueprint for backend container
```

---

## API Reference

All HTTP JSON endpoints live under `/api/v1` (except health probes). Interactive OpenAPI schemas are available at `/docs` when running in local mode.

| Method & Path                                         | Description                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /health/live`, `GET /health/ready`               | Liveness and database/migration readiness checks                              |
| `GET /api/v1/games`                                   | List supported games (`lotto_535`, `mega_645`, `power_655`) and ball ranges   |
| `GET /api/v1/games/{game}/status`                     | Latest draw metadata, ingestion timestamps, and `data_version`                |
| `GET /api/v1/games/{game}/draws/latest`               | Most recent recorded draw                                                     |
| `GET /api/v1/games/{game}/draws`                      | Paginated draws with `from_date`, `to_date`, `draw_id`, and `sort` filters    |
| `GET /api/v1/games/{game}/draws/{draw_id}`            | Single draw record and prize breakdown (`.../prizes`)                         |
| `GET /api/v1/games/{game}/analytics/numbers`          | Frequency, rank, and gap metrics (`number_kind=main\|special` for Lotto 5/35) |
| `GET /api/v1/games/{game}/analytics/numbers/{number}` | Number detail with top co-occurring partners and appearance log               |
| `GET /api/v1/games/{game}/analytics/pairs`            | Paginated co-occurring main pairs (`min_frequency`, `sort`)                   |
| `GET /api/v1/games/{game}/analytics/pairs/{a}/{b}`    | Pair metrics and shared historical draws                                      |
| `POST /api/v1/games/{game}/combinations/check`        | Historical exact match count, overlap histogram, and similar draws            |
| `POST /api/v1/games/{game}/combinations/generate`     | Deterministic rule-filtered main-number generator with explanations           |
| `POST /api/v1/games/{game}/sync`                      | Trigger manual bounded sync (`60s` per-game cooldown, `409` if busy)          |

**Authentication Model:** End users require no login. In cloud mode (`LOTTO_DEPLOYMENT_MODE=cloud`), direct requests to Render endpoints require `X-Lotto-Origin-Token` (injected server-side by Vercel's `/api/gateway`), while `/health/live` remains public for platform health checks.

---

## Testing

All verification commands follow the repository's backend (`uv` / `pytest`) and frontend (`npm` / `vitest` / `playwright`) quality checks.

> [!CAUTION]
> Backend integration tests **truncate tables** in the database targeted by `LOTTO_TEST_DATABASE_URL`. Always point `LOTTO_TEST_DATABASE_URL` to a dedicated test database (e.g., `lotto_test`), never your application database.

### Backend Quality Gates

```bash
# Ensure PostgreSQL test database exists and is migrated before pytest
docker compose exec -T postgres createdb -U lotto lotto_test

cd backend
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pyright
LOTTO_DATABASE_URL=postgresql+psycopg://lotto:lotto@127.0.0.1:5432/lotto_test uv run --locked alembic upgrade head
LOTTO_DATABASE_URL=postgresql+psycopg://lotto:lotto@127.0.0.1:5432/lotto_test uv run --locked alembic check
uv run --locked pytest
```

### Frontend Quality Gates & Browser E2E

```bash
cd frontend
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build

# End-to-end Playwright + Axe accessibility suite (optionally set PLAYWRIGHT_BASE_URL=http://127.0.0.1:8088)
npm run test:e2e
```

---

## Deployment

### Free Cloud Stack (`Vercel` + `Render` + `Neon`)

- **Database**: Neon Free PostgreSQL 16 (direct TLS URL required — avoid `-pooler.` hostnames so PostgreSQL session advisory locks work reliably).
- **Backend**: Deployed via Blueprint [`render.yaml`](render.yaml) on Render Free (`plan: free`, region `singapore`) using [`backend/Dockerfile`](backend/Dockerfile) and `python -m app.commands.serve`.
- **Frontend & Gateway**: Deployed from `frontend/` via [`frontend/vercel.json`](frontend/vercel.json), serving the static Vite bundle alongside serverless routes `/api/gateway` and `/api/data`.
- **Smoke Check**: After deploying, run the read-only verifier:

  ```bash
  node scripts/cloud-smoke.mjs https://your-site.vercel.app https://your-api.onrender.com
  ```

### Local Wi-Fi Sharing (Opt-In)

To expose the local Docker frontend over trusted LAN Wi-Fi without opening PostgreSQL or FastAPI ports publicly, bind `FRONTEND_LAN_IP` in `.env` and layer [`compose.lan.yaml`](compose.lan.yaml).

---

## Limitations & Roadmap

### Current Limitations

- **No Automatic Scheduled Sync by Default**: `LOTTO_SCHEDULER_ENABLED` defaults to `false`; new draws are added via manual UI/API sync or explicit CLI jobs.
- **Free-Tier Cold Starts**: Render Free sleeps after ~15 minutes without inbound traffic; initial requests after idle periods may experience cold-start latency.
- **Upstream Challenge & Rate Limits**: Vietlott endpoints impose rate limits (`>= 1.0s` spacing enforced in backend settings) and occasional Cloudflare challenges. Opt-in community fallback (`LOTTO_COMMUNITY_FALLBACK_ENABLED=true`) mitigates manual sync blocks on verified checkpoints, while full historical/prize audits still rely on official pages.
- **Decoupled Generator UI**: `/generator` executes local browser physics (Rapier3D) and does not call the backend rule-based `/combinations/generate` API endpoint.

### Documented Roadmap (Out of MVP Scope)

Items beyond the completed MVP scope include:

- **Phase 2 Analytics**: Saved strategy definitions, strict pre-cutoff historical backtesting, and random-baseline comparisons.
- **AI Analytics Chat V1** _(design specification only — not yet implemented)_: Evidence-grounded Vietnamese Q&A interface backed by read-only analytics tool calls over immutable turn snapshots.

---

## License

This repository does not currently include an explicit open-source `LICENSE` file. All rights remain unspecified until a license is added by the repository owner.
