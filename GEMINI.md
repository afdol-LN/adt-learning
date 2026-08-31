# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## What this repo is

`adt-learning` is the **backend** of an adaptive e-learning platform built around Bayesian Knowledge Tracing (BKT): a NestJS API (`server/app/`) plus a Python FastAPI knowledge-tracing microservice (`server/btk-engine/`), and project docs (`docs/`). It is its own git repo — the React/Vite frontend lives in a sibling repo, `../G06_adaptive_learning`, not inside this one. The frontend calls the NestJS API over REST; matching resource names confirm the pairing (e.g. frontend `skillPanel` ↔ this repo's `/skill` controller, `userPanel` ↔ `/user`, etc.).

`_bmad/`, `_bmad-output/`, `.agent/skills/`, `.opencode/` at this repo's root are the BMAD-METHOD agentic planning toolkit, not application code.

> A parent-level [`CLAUDE.md`](../CLAUDE.md) / [`GEMINI.md`](../GEMINI.md) also documents this repo alongside the frontend, for sessions working across both. Keep this file and that one in sync when either changes.

## Architecture: Controller → Service → Entity

- **Layering**: `controller/` → `service/` → TypeORM `entity/` (via `@nestjs/typeorm` repositories), with `dto/` for request/response shapes and `model/` for plain domain types distinct from entities. Add or extend the service first (data access + shape), then the controller (orchestration/HTTP concerns) — don't put query/business logic directly in a controller.
- **`BaseController<T>` / `IBaseService<T>`** (`server/app/src/controller/base.controller.ts`, `server/app/src/type/base-service.interface.ts`): generic CRUD (`create`/`findAll`/`findOne`/`update`/`remove`). Most resource controllers (`skillController`, `campusController`, `facultyController`, etc.) extend `BaseController` and only add resource-specific endpoints on top (e.g. `skillController` adds `/with-prerequisite` routes for the skill+prerequisite composite writes). Reuse this base instead of hand-rolling CRUD for a new simple resource.
- **`restfulResponse<T>`** (`server/app/src/dto/restfulResponse.ts`) is the standard response envelope (`{ isError, data, errorMessage }`) — match it in new endpoints rather than returning raw entities/arrays, since the frontend's service layer expects this shape.
- **`AppModule`** (`server/app/src/app.module.ts`) is the single module — no feature modules. New entities/controllers/services must be registered here manually (imports, `TypeOrmModule.forFeature([...])`, `controllers`, `providers`). `ktController`/`ktService` are registered and `AuthMiddleWare` is applied globally (`consumer.apply(AuthMiddleWare).forRoutes('*')`, excluding register/login/`/kt/*`/swagger docs routes) — both are live today. This has flipped before (see [Security](#security--data-protection-pdpa)), so re-check this file rather than trusting older notes.
- **Auth**: `AuthMiddleWare` (`server/app/src/middleware/authMiddleWare.ts`) validates `Bearer` JWTs via `libs/jwt.ts` and attaches `req.user`. There is no separate admin/role guard in this codebase — see [Security](#security--data-protection-pdpa).
- **Realtime**: `events/event.gateway.ts` (`@nestjs/websockets` + socket.io) for websocket events.
- **Knowledge-tracing bridge**: `controller/kt.controller.ts` / `service/kt.service.ts` proxy skill/item/attempt/mastery requests to the Python `btk-engine` FastAPI service via `HttpModule`/axios. `libs/bkt/` holds related TS-side helpers.

## Commands

```bash
cd server/app
npm run start:dev          # nest start --watch
npm run build               # nest build
npm run lint                 # eslint --fix
npm test                     # jest (unit, src/**/*.spec.ts)
npm run test:watch
npm run test:cov
npx jest path/to/file.spec.ts   # run a single test file
npm run test:e2e             # jest -c test/jest-e2e.json

# TypeORM migrations (build first — entities/migrations run from dist/)
npm run migration:generate   # generates into src/migrations/
npm run migration:run
npm run migration:revert
npm run seed                  # runs dist/seeds/master-data.seed.js
npm run backfill:concept-map  # runs dist/seeds/backfill-concept-map-state.seed.js
```

DB connection is `DATABASE_URL` (see `.env`), configured in `server/app/src/config/data-source.ts`. `synchronize` is always `false` — schema changes go through migrations. SSL auto-enables for Supabase/`sslmode=require` URLs.

```bash
cd server/btk-engine/app
# .venv is checked in (at btk-engine/.venv); otherwise: pip install -r requirements.txt
uvicorn main:app --reload
```

## `server/btk-engine/` — Knowledge-tracing microservice (Python)

FastAPI service implementing KT-IDEM (Bayesian Knowledge Tracing with per-item difficulty), built on `pyBKT`, `pandas`/`numpy`/`scikit-learn`.

- `app/main.py` — FastAPI app, mounts `app/routers/kt.py` and a `/health` check.
- `app/routers/kt.py` — `POST /kt/attempt` (process a student attempt, returns updated mastery) and `POST /kt/calibrate` (re-run parameter calibration via `app/script/calibrate.py`).
- `app/service/kt_service.py` — BKT model logic (uses `pyBKT`).
- `app/models/bkt_kt_idem.py`, `app/schemas/bkt_schema.py`, `app/storage.py` — model persistence/schemas.
- Called by the NestJS backend's `kt.controller.ts`/`kt.service.ts`. Nothing in this router adds auth of its own — see [Security](#security--data-protection-pdpa).

## Data model (13-table schema)

- **University/user group**: `userprofile`, `gender`, `campus`, `faculty`, `major`, `branch`.
- **Session/exercise group**: `session`, `exercise`, `exerciseChoice`.
- **Goal/skill group (staff-CRUD-able)**: `goal`, `skill`, `skillPrerequisite`, `goalSkillRequire`.
- High-frequency per-action student state (BKT mastery, behavior/Elo history) is **not** stored relationally — it's cached in Redis and flushed as JSON into `userprofile.conceptMapState` / `userprofile.strengthWeaknessMatrix` to avoid write amplification. Curriculum metadata (`skill`, `skillPrerequisite`, `goalSkillRequire`) stays relational because staff need CRUD access via the admin dashboard.
- **Prerequisite unlock rule**: a skill unlocks only when *all* its parent prerequisites (from `skillPrerequisite`) have reached ≥60% progress in the student's `conceptMapState`.

## Security & data protection (PDPA)

`userprofile` (`server/app/src/entity/userprofile.entity.ts`) holds personal and behavioral data in scope for Thailand's PDPA (Personal Data Protection Act) — `fullName`, `birthDate`, `genderId`, campus/faculty/major, plus derived learning-behavior data (`behaviorScore`, `conceptMapState`, `strengthWeaknessMatrix`). Treat all of it as PII, not just the obvious name/DOB fields:

- **Minimize exposure**: endpoint responses (especially admin-panel list endpoints) should return only the fields a screen needs via DTOs, not full entities. Don't log request/response bodies that contain the fields above.
- **Password storage is weak, don't extend it**: `server/app/src/libs/hash.ts` hashes passwords with plain `SHA-256` + a hardcoded static salt (`'&'`), not an adaptive/salted-per-user algorithm (bcrypt/argon2/scrypt). This is an existing gap, not a pattern to copy — flag it rather than reusing `Hash.hashSha256`/`hashWithSaltAndDate` for any new sensitive data.
- **`AuthMiddleWare` only checks "is this a valid JWT?"** — it does **not** enforce role (`UserRole.USER` vs `UserRole.ADMIN`) or resource ownership, and there is no separate admin guard in the codebase. Any endpoint meant to be admin-only or scoped to "the logged-in user's own data" must check `req.user.role` / `req.user.id` itself inside the controller or service. This has been a live, previously-documented gap (see `docs/to-do.md`, which flagged `/goal` mutating routes as unauthenticated while `AuthMiddleWare` was disabled) — `AuthMiddleWare` is enabled globally again now, but the missing role check is still open.
- **`/kt/*` routes bypass `AuthMiddleWare` entirely** (explicitly excluded in `app.module.ts`), and the FastAPI `btk-engine` service itself has no auth on its own routes either — anyone who can reach it can submit attempts or trigger recalibration. Don't assume these routes are protected when reasoning about data exposure.
- **Env secrets**: `JWT_SECRET` and `DATABASE_URL` come from `.env` (see `server/app/src/config/`) — never hardcode or log these.

## Reusable building blocks

Before adding a new resource from scratch, check for an existing pattern to extend rather than hand-rolling one:

- `BaseController<T>` / `IBaseService<T>` for standard CRUD (see [Architecture](#architecture-controller--service--entity)).
- `restfulResponse<T>` for response shape.
- `dto/` for request/response validation (`class-validator`) — new endpoints should validate input the same way rather than trusting raw request bodies.

## Working conventions

- After making an edit, briefly describe what changed and why (not just a diff restatement) before moving to the next step.
- Before trusting a claim in this file or in `docs/`, confirm it against the current code — `app.module.ts` in particular has flipped between "AuthMiddleWare enabled" and "disabled" before (see `docs/to-do.md` vs. current state).

## Notes

- Most in-repo comments and some docs (e.g. `data-source.ts`) are written in Thai.
- `docs/` currently has `to-do.md` (a dated code-review punch list for the Goal admin panel) and `home_page_real_data_implementation_plan.md`.
- This file is kept in sync with [`CLAUDE.md`](CLAUDE.md) in this same directory. Update both together.
