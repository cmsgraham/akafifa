# The Tournament Hub — Product Design Specification

**Version:** 1.1
**Date:** April 2, 2026
**Status:** Ready for Implementation

> This file supersedes `design_document.txt`. It preserves all original requirements, removes AI-prompting instructions that do not belong in a design spec (former "Role/Objective" header and former Section 15 "Output Format"), fills in concrete details that were vague or missing, adds a match status state machine, a duel lifecycle state machine, SQL schema, database indexes, API standards, a folder structure reference, performance targets, and a full implementation progress tracker.

---

## Progress Tracker

Use this section to track implementation across phases. Check each item when it is **done and verified** (merged + tested).

### Phase 0 — Project Setup & Infrastructure
- [ ] Repository created with agreed folder structure
- [ ] Docker Compose scaffold with all containers defined
- [ ] `.env.example` created with all required variables
- [ ] PostgreSQL container with named volume `db_data`
- [ ] Redis container
- [ ] FastAPI (`web`) container
- [ ] Next.js (`frontend`) container
- [ ] Background worker (`worker`) container
- [ ] Periodic scheduler (`scheduler`) container
- [ ] One-shot migrations container (`migrations`)
- [ ] Nginx (`nginx`) container as reverse proxy (routes `/api/*` → `web`, `/*` → `frontend`)
- [ ] Nginx config: HTTP → HTTPS redirect, proxy headers (`X-Forwarded-For`, `X-Real-IP`), gzip enabled
- [ ] Nginx serves static Next.js assets directly from a shared volume (`/app/.next/static`)
- [ ] SSL/TLS certificates provisioned via Let's Encrypt (Certbot) and mounted into the `nginx` container
- [ ] `mailpit` container for local SMTP catch-all and email inspection (port 8025 UI, port 1025 SMTP)
- [ ] Production SMTP relay configured via environment variables (no `mailpit` in production)
- [ ] Local development workflow documented in README
- [ ] `GET /api/health` endpoint returns `200`
- [ ] `GET /api/health/ready` endpoint returns `200` after migrations complete
- [ ] CI pipeline skeleton: lint and test steps defined

### Phase 1 — Database Schema & Migrations
- [ ] Alembic (or equivalent) migration tooling initialized
- [ ] `users` table
- [ ] `user_profiles` table
- [ ] `tournaments` table
- [ ] `teams` table
- [ ] `stages` table
- [ ] `matches` table
- [ ] `match_results` table
- [ ] `predictions` table
- [ ] `flash_challenges` table
- [ ] `flash_challenge_options` table
- [ ] `flash_challenge_answers` table
- [ ] `duel_challenges` table
- [ ] `comments` table
- [ ] `prizes` table
- [ ] `leaderboard_snapshots` table
- [ ] `notifications` table
- [ ] `outbound_email_jobs` table
- [ ] `audit_logs` table
- [ ] All foreign keys, unique constraints, and CHECK constraints applied
- [ ] All indexes from Section 10.2 applied
- [ ] Seed migration for demo data (Phase 17)

### Phase 2 — Authentication & User Management
- [ ] `POST /api/auth/register` — with email domain restriction
- [ ] `POST /api/auth/login`
- [ ] `POST /api/auth/logout`
- [ ] `POST /api/auth/refresh`
- [ ] `POST /api/auth/forgot-password`
- [ ] `POST /api/auth/reset-password`
- [ ] `GET /api/auth/me`
- [ ] JWT issued as httpOnly, SameSite=Strict cookie (15-minute access token)
- [ ] Refresh token rotation on each use (7-day expiry)
- [ ] Argon2id password hashing
- [ ] Password reset signed token (1-hour expiry)
- [ ] Email domain allowlist enforced via `ALLOWED_EMAIL_DOMAINS`
- [ ] Rate limiting on login (10/IP/15 min), register (5/IP/hr), reset (3/email/hr)
- [ ] CSRF protection on all state-changing endpoints

### Phase 3 — User Profiles
- [ ] `GET /api/me/profile`
- [ ] `PUT /api/me/profile`
- [ ] `POST /api/me/avatar`
- [ ] Avatar file validation: MIME type (jpeg, png, webp), max 2 MB, max 2000×2000 px
- [ ] Avatar stored on named Docker volume `avatars` by default
- [ ] S3-compatible storage path selectable via `AVATAR_STORAGE=s3`
- [ ] Favorite team FK association

### Phase 4 — Tournament & Match Data
- [ ] External soccer API abstraction layer (`services/soccer_api/base.py`)
- [ ] Football-Data.org (or API-Football) concrete provider implementation
- [ ] Sync: tournaments, teams, stages, matches
- [ ] Store per match: kickoff UTC, venue, status, result
- [ ] External API response caching (avoid rate-limit issues)
- [ ] Scheduled background sync job (configurable interval, default 5 minutes)
- [ ] `GET /api/tournaments/:id/matches`
- [ ] `GET /api/matches/:id`
- [ ] `POST /api/admin/sync/matches` — manual trigger
- [ ] `PUT /api/admin/matches/:id/result` — manual result override
- [ ] Match status transitions enforced (see Section 6.1 state machine)

### Phase 5 — Predictions & Lock-out
- [ ] `POST /api/matches/:id/prediction`
- [ ] `PUT /api/matches/:id/prediction`
- [ ] `GET /api/me/predictions`
- [ ] `calculate_lock_at()` function implemented and unit-tested
- [ ] `is_prediction_editable()` function implemented and unit-tested
- [ ] Server-side lock-out enforcement (independent of client)
- [ ] One prediction per user per match (DB unique constraint + application check)
- [ ] Lock-out hours configurable via `PUT /api/admin/settings/lockout`
- [ ] `lock_at` stored per match at creation/update time

### Phase 6 — Scoring Engine
- [ ] `calculate_points()` function implemented and unit-tested
- [ ] `ScoringConfig` dataclass with extensibility hooks (unused in v1)
- [ ] `ScoringResult` dataclass returned with `points`, `result_type`, `metadata`
- [ ] Score recalculation job triggered on match confirmation
- [ ] `POST /api/admin/matches/:id/recalculate` — manual override
- [ ] Idempotency: skip re-write if points/result_type unchanged for same result

### Phase 7 — Leaderboards
- [ ] Global leaderboard query with full tie-breaker chain
- [ ] Tournament leaderboard query
- [ ] Stage/round leaderboard query
- [ ] Stage snapshot frozen on `POST /api/admin/stages/:id/freeze`
- [ ] Redis leaderboard caching
- [ ] Cache invalidation on score update or new confirmed prediction
- [ ] `GET /api/leaderboards/global`
- [ ] `GET /api/leaderboards/tournament/:id`
- [ ] `GET /api/leaderboards/stage/:id`
- [ ] All leaderboard endpoints return cursor-paginated responses

### Phase 8 — Social: The Lounge
- [ ] `GET /api/matches/:id/comments` — cursor-paginated
- [ ] `POST /api/matches/:id/comments`
- [ ] `PUT /api/comments/:id` — within 5-minute grace period
- [ ] `DELETE /api/comments/:id` — within 5-minute grace period (admin bypasses)
- [ ] `DELETE /api/admin/comments/:id` — admin moderation
- [ ] Rate limit: 5 comments per user per match per minute
- [ ] Max comment length: 500 characters enforced server-side
- [ ] Grace-period enforcement server-side (client countdown is informational only)
- [ ] Optional banned-word filter (configurable list, off by default)

### Phase 9 — Duels
- [ ] `POST /api/matches/:id/duels`
- [ ] `POST /api/duels/:id/accept`
- [ ] `POST /api/duels/:id/decline`
- [ ] `GET /api/me/duels`
- [ ] Duel expiration: default 24 hours (configurable via `DUEL_INVITE_EXPIRY_HOURS`)
- [ ] Background job to mark expired duels (`expired`)
- [ ] Duel resolution on match confirmation (see Section 13.2)
- [ ] Duel win/loss/draw counters updated on `user_profiles`
- [ ] One active duel per challenger/opponent/match combination enforced
- [ ] Badge/streak display on profile (no money or gambling language)

### Phase 10 — Flash Challenges
- [ ] `GET /api/challenges/active`
- [ ] `POST /api/challenges/:id/answer`
- [ ] `GET /api/me/challenges`
- [ ] `POST /api/admin/challenges`
- [ ] `PUT /api/admin/challenges/:id`
- [ ] `POST /api/admin/challenges/:id/resolve`
- [ ] `yes_no` challenge type
- [ ] `multiple_choice` challenge type
- [ ] Open/close time enforced server-side
- [ ] Manual resolution flow via admin API
- [ ] Points awarded to correct answers on resolution
- [ ] Challenge scope: `match` or `stage` (both supported)

### Phase 11 — Notifications & Email
- [ ] `notifications` table and service abstraction created
- [ ] Email job enqueue in `web` container (never sends directly)
- [ ] Worker container delivers emails via SMTP
- [ ] Welcome email plain-text template
- [ ] Password reset email plain-text template
- [ ] 24-hour prediction reminder plain-text template
- [ ] Winner announcement plain-text template
- [ ] Flash challenge announcement plain-text template
- [ ] Duel invitation plain-text template
- [ ] Duel result plain-text template
- [ ] Retry with exponential backoff (max 5 attempts, starting at 30 seconds)
- [ ] Dead-letter logging after all retries exhausted
- [ ] Failed delivery logged with full error trace

### Phase 12 — Admin Tools
- [ ] `PUT /api/admin/settings/lockout`
- [ ] `GET /api/admin/audit-logs` — paginated, filterable by `user_id`
- [ ] `GET /api/admin/users/:id`
- [ ] `POST /api/admin/users/:id/reset-password`
- [ ] `POST /api/admin/users/:id/resend-email`
- [ ] `POST /api/admin/users/:id/unlock`
- [ ] `PUT /api/admin/users/:id/role`
- [ ] `POST /api/admin/stages/:id/freeze`
- [ ] Tournament and stage CRUD
- [ ] Prizes CRUD
- [ ] All admin mutations written to `audit_logs`

### Phase 13 — Frontend
- [ ] Login / Register / Forgot Password / Reset Password screens
- [ ] Home dashboard
- [ ] Tournament overview
- [ ] Match list and match detail
- [ ] Prediction entry and edit form
- [ ] Leaderboard screen (global + stage tabs)
- [ ] Match Lounge (comments with pagination)
- [ ] Duel Center (send, accept/decline, history)
- [ ] Flash Challenge Center
- [ ] Profile page (stats, avatar upload, favorite team)
- [ ] Admin dashboard
- [ ] Admin: match management and result override
- [ ] Admin: flash challenge CRUD and resolution
- [ ] Admin: user management and support tools
- [ ] Admin: audit log viewer
- [ ] Dark mode (respects OS preference)
- [ ] Fully usable at 320px width — no horizontal overflow, no clipped controls
- [ ] Tap targets minimum 44×44 px
- [ ] Skeleton loading states on all async data
- [ ] Lock/open state badges on match cards
- [ ] Countdown to lock-out on match card and prediction form
- [ ] Responsive breakpoints: 320px, 390px, 768px, 1024px, 1280px
- [ ] Favorite team subtle UI accent (color chip or small flag)
- [ ] Accessible forms: aria labels, keyboard nav, visible focus states

### Phase 14 — Testing & QA
- [ ] Unit: `calculate_lock_at()` and `is_prediction_editable()`
- [ ] Unit: `calculate_points()` — exact, outcome, miss cases
- [ ] Unit: tie-breaker ordering logic
- [ ] Unit: duel resolution — win, loss, draw, missing prediction case
- [ ] Unit: flash challenge resolution — yes/no and multiple choice
- [ ] Unit: comment grace period enforcement
- [ ] Integration: register with valid domain → success
- [ ] Integration: register with blocked domain → 403
- [ ] Integration: full login / refresh / logout cycle
- [ ] Integration: forgot password → reset flow
- [ ] Integration: prediction submission before lock → success
- [ ] Integration: prediction submission after lock → 400
- [ ] Integration: prediction edit before lock → success
- [ ] Integration: prediction edit after lock → 400
- [ ] Integration: global leaderboard with tie-breaking verification
- [ ] Integration: stage leaderboard frozen after `freeze` call
- [ ] Integration: comment edit within grace period → success
- [ ] Integration: comment edit after grace period → 403
- [ ] Integration: admin deletes any comment → success
- [ ] Integration: user deletes another user's comment → 403
- [ ] Integration: admin-only endpoint by non-admin → 403
- [ ] Integration: full duel lifecycle (pending → accepted → scored)
- [ ] Integration: duel expiry (not accepted in time → expired)
- [ ] Integration: flash challenge answer before `close_at` → success
- [ ] Integration: flash challenge answer after `close_at` → 400
- [ ] Seed fixtures verified: system demonstrable after `docker compose up`

### Phase 15 — Production Readiness
- [ ] Nginx config file reviewed and hardened (TLS 1.2+, HSTS header, server_tokens off)
- [ ] SSL/TLS certificates issued via Certbot and mounted into `nginx` container
- [ ] HTTP → HTTPS redirect confirmed in Nginx config
- [ ] Nginx rate-limit zone configured at the proxy layer (secondary defence behind app-level limits)
- [ ] All `.env` values populated for production Linode instance
- [ ] PostgreSQL backup schedule configured (7 daily, 4 weekly)
- [ ] Container restart policies set to `unless-stopped`
- [ ] Named volume persistence verified after container restart
- [ ] `GET /api/health` and `GET /api/health/ready` verified in production
- [ ] Log output structured as JSON and visible via `docker logs`
- [ ] Linode deployment walkthrough in README verified end-to-end
- [ ] README reviewed: local setup and production deployment sections complete

---

## 1. Definitions and Conventions

| Term | Meaning |
|------|---------|
| Lock-at | UTC timestamp after which predictions for a match become read-only |
| Stage | A named tournament phase, e.g., Group Stage, Round of 16, Quarterfinals, Final |
| Duel | A 1-vs-1 prediction competition between two users on a specific match |
| Flash Challenge | An admin-created binary or multiple-choice question tied to a match or stage |
| Exact Score | Predicted home and away scores both match the actual result exactly |
| Correct Outcome | Predicted outcome (home win / draw / away win) matches, but individual scores differ |
| Admin | A user with role `admin` who can manage tournaments, challenges, scores, and users |
| Confirmed | A match whose result has been verified and used for scoring |

All timestamps are stored and processed in **UTC**. The UI converts to the user's local timezone for display only. The server never accepts client-supplied timezone offsets as authoritative.

---

## 2. Product Scope

### Users can
- View tournament matches and schedules
- Submit and edit predictions before match lock-out
- View personal and global leaderboards
- Participate in match-specific social discussions (The Lounge)
- Challenge other users in 1-vs-1 prediction duels
- Answer admin-created flash challenges
- Manage their profile, display name, avatar, favorite team, and bio

### Admins can additionally
- Manage tournament and stage configuration
- Define and reconfigure prediction lock-out timing
- Create, edit, resolve, and delete flash challenges
- Assign and award prizes for stages and the overall tournament
- Manually override match scores or challenge results
- Trigger external data re-sync
- Review and filter audit logs
- Declare stage and tournament winners
- Perform non-impersonating user support actions (see Section 13.4)

---

## 3. Architecture & Tech Stack

### 3.1 Frontend
- **Framework:** Next.js with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Design:** Mobile-first, responsive, modern and slightly game-like, polished for corporate use

### 3.2 Backend
- **Framework:** FastAPI (Python)
- **API style:** REST
- **Task scheduling:** Separated from the web process into a dedicated worker container

### 3.3 Database
| System | Role |
|--------|------|
| PostgreSQL | Primary relational database; source of truth for all data |
| Redis | Leaderboard caching, rate limiting, background job queues and state |

### 3.4 Background Jobs
- **Queue system:** RQ or Celery backed by Redis
- **Worker container handles:**
  - Outbound email jobs
  - Scheduled prediction reminders (24h before lock-out)
  - External API sync tasks
  - Leaderboard cache rebuilds
  - Duel expiration sweeps

### 3.5 Infrastructure
| Container | Purpose |
|-----------|---------|
| `web` | FastAPI REST API |
| `frontend` | Next.js application |
| `db` | PostgreSQL |
| `redis` | Redis |
| `web` | FastAPI REST API |
| `frontend` | Next.js application |
| `db` | PostgreSQL |
| `redis` | Redis |
| `worker` | Background job worker |
| `scheduler` | Periodic task scheduler (beat process) |
| `migrations` | One-shot migration runner; exits after completion |
| `nginx` | Reverse proxy — SSL/TLS termination, routes traffic to `web` and `frontend` |
| `mailpit` | SMTP catch-all + web UI for local development (disabled in production) |

**Deployment target:** Ubuntu on Linode, orchestrated with Docker Compose.

---

## 4. Environment Definitions

| Environment | Purpose |
|-------------|---------|
| `local` | Developer laptop using local Docker Compose |
| `staging` | Optional pre-production Linode instance for validation |
| `production` | Live corporate deployment on Linode |

Secrets and environment-specific configuration are managed **exclusively via environment variables**. No credentials are hard-coded anywhere in the codebase.

---

## 5. Core Functional Requirements

### 5.1 Tournament & Match Data

**External API integration**

Integrate with a soccer data API (Football-Data.org or API-Football). The provider is abstracted behind a service layer (`services/soccer_api/base.py`) and must be replaceable without touching business logic.

The system must sync: tournaments, teams, groups, stages, matches (kickoff UTC, venue, status, result).

**Rules:**
- Cache external API responses to avoid rate limit issues
- Support manual admin refresh via `POST /api/admin/sync/matches`
- Support scheduled background syncs (default: every 5 minutes, configurable)
- Support admin override of match data when the provider is wrong or delayed

**Match status state machine**

```
SCHEDULED → LIVE → FINISHED → CONFIRMED
                ↘ POSTPONED
          ↘ CANCELLED
```

| Status | Meaning |
|--------|---------|
| `scheduled` | Upcoming; predictions open if before `lock_at` |
| `live` | Match in progress |
| `finished` | Match ended; result available but not yet used for scoring |
| `confirmed` | Result confirmed; scoring processed |
| `postponed` | Match delayed; admin may recalculate `lock_at` |
| `cancelled` | Match will not occur |

Transitions are enforced both by the sync job and admin override endpoints.

### 5.2 Predictions

Users submit one prediction per match:
- Home team score (non-negative integer)
- Away team score (non-negative integer)

**Rules:**
- Predictions are editable until the match `lock_at` timestamp
- After `lock_at`, predictions become read-only
- Once a match reaches `confirmed`, points are calculated automatically
- Score recalculation is idempotent — safe to re-run multiple times

### 5.3 Lock-out Logic

**Configuration:** Lock-out offset is stored in hours before kickoff. Default: 1 hour. Configurable by admins via `PUT /api/admin/settings/lockout`.

**Implementation:**
- `lock_at = kickoff_utc − lockout_hours`
- `lock_at` is stored per match at creation/update time
- Config changes do **not** retroactively update published `lock_at` values unless an admin explicitly triggers reprocessing
- Server-side validation enforces lock-out regardless of client state

**Function contracts:**

```python
def calculate_lock_at(kickoff_utc: datetime, lockout_hours: float) -> datetime: ...

def is_prediction_editable(lock_at: datetime, now: datetime | None = None) -> bool: ...
```

Both functions must have unit tests covering boundary conditions (exactly at lock-at, 1 second before, 1 second after).

### 5.4 Scoring System

**Default scoring model:**

| Result | Points |
|--------|--------|
| Exact score (home and away both match) | 3 |
| Correct outcome only (win/draw/loss direction) | 1 |
| No match | 0 |

**Outcome determination:**
- Home win: `predicted_home > predicted_away`
- Draw: `predicted_home == predicted_away`
- Away win: `predicted_home < predicted_away`

**Function contract:**

```python
@dataclass
class ScoringConfig:
    exact_points: int = 3
    outcome_points: int = 1
    # Extensibility hooks (all disabled in v1):
    underdog_multiplier: float = 1.0
    knockout_bonus: int = 0
    round_multiplier: float = 1.0

@dataclass
class ScoringResult:
    points: int
    result_type: Literal["exact", "outcome", "miss"]
    metadata: dict  # consumed by leaderboard aggregation

def calculate_points(
    predicted_home: int,
    predicted_away: int,
    actual_home: int,
    actual_away: int,
    config: ScoringConfig = DEFAULT_CONFIG,
) -> ScoringResult: ...
```

`ScoringConfig` must allow future variants (underdog weighting, knockout bonuses, round multipliers) to be activated without changing the function signature.

### 5.5 Leaderboards

**Supported views:**
- Global (all matches, full tournament duration)
- By tournament
- By round/stage

**Stage leaderboards are frozen** (read-only snapshots) once an admin calls `POST /api/admin/stages/:id/freeze`. The global leaderboard remains live throughout the tournament.

**Tie-breaker order (applied sequentially):**
1. Highest total points
2. Highest exact-score hit count
3. Highest correct-outcome hit count
4. Earliest average prediction submission time before lock-out
5. Username alphabetical (stable final tie-breaker)

**Caching:** Redis caches leaderboard views. PostgreSQL is the source of truth. Cache is invalidated or rebuilt on any score update or new confirmed prediction.

### 5.6 Social — The Lounge

Each match has a comment feed.

**Rules:**
- Authenticated users can post comments
- Users can edit or delete their own comments within a **5-minute grace period** from creation
- Admins can delete any comment; they are not subject to the grace period
- Comments are returned in cursor-paginated responses (see Section 8.2)
- Rate limit: **5 comments per user per match per minute**
- Maximum comment length: **500 characters**
- Optional banned-word filter: configurable list, **off by default**
- Real-time updates: polling in v1; SSE or WebSocket as a future upgrade

### 5.7 Duels

Users challenge each other to 1-vs-1 prediction competitions on a specific match.

**Lifecycle:**

```
PENDING → ACCEPTED → SCORED (on match confirmation)
        ↘ DECLINED
        ↘ EXPIRED (configurable timeout, default 24 h)
```

**Rules:**
- One user initiates; the target must accept or decline
- Both submit predictions through the standard prediction flow (no separate duel prediction form)
- Match confirmation triggers automatic duel scoring
- Tied duels are marked `draw`
- If a user has no prediction, they receive 0 points for the duel; the other user wins
- Only one active duel per challenger/opponent/match combination is allowed
- Expired invitations cannot be accepted
- Duel invitation expiry: **24 hours** (configurable via `DUEL_INVITE_EXPIRY_HOURS`)

**User-facing features:**
- Duel history view
- Badge and streak counters on profile (engagement only; no money, no gambling language)

### 5.8 Flash Challenges

Admin-created questions attached to a match or a tournament stage.

**Challenge types (v1):**
- `yes_no` — Binary answer (Yes / No); internally stored as a two-option `multiple_choice`
- `multiple_choice` — One correct answer from a predefined option list

**Challenge scope:**
- `match` — Linked to a specific match via `match_id` FK
- `stage` — Linked to a tournament stage via `stage_id` FK

**Admin-configurable fields per challenge:**

| Field | Description |
|-------|-------------|
| `title` | Challenge question text |
| `description` | Optional explanatory text |
| `type` | `yes_no` or `multiple_choice` |
| `options` | Option labels (required for `multiple_choice`) |
| `open_at` | When users can start answering |
| `close_at` | When answers are locked |
| `points_value` | Points awarded for correct answer |
| `resolution_method` | `manual` or `automatic` |
| `scope` | `match` or `stage` |

**Resolution:**
- `manual` — Admin confirms the correct option via `POST /api/admin/challenges/:id/resolve`
- `automatic` — System resolves based on match data if the data provider supports it (future feature; not active in v1)

**Challenge status lifecycle:** `draft → open → closed → resolved / cancelled`

---

## 6. Communication System

### 6.1 Email Architecture

**Design constraint:** All outbound email is **plain text only**. No HTML, no embedded images, no marketing formatting.

**Architecture:**
- The `web` container enqueues email jobs only; it never sends directly
- The `worker` container executes delivery via SMTP
- Retries with exponential backoff: max **5 attempts**, starting at **30 seconds**
- After all retries fail: job moves to `dead_letter` status with full error trace logged
- Email templates are versioned plain-text files stored in the codebase (`services/email/templates/`)

**Local development mail server:**
- Use **Mailpit** (`axllent/mailpit` Docker image) as an SMTP catch-all
- All outbound email is captured locally; no real email is ever sent during development
- Mailpit web UI is accessible at `http://localhost:8025` for inspecting email output
- Worker points to `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, no credentials, no TLS in dev
- Mailpit container is defined only in `docker-compose.override.yml` so it is never started in production

**Production mail server:**
- Use a real SMTP relay (e.g., AWS SES, Postmark, Mailgun, or a self-hosted Postfix)
- All connection details supplied exclusively via environment variables
- No fallback to Mailpit in production; if `SMTP_HOST` is not set, the worker refuses to start

**SMTP configuration (all via environment variables):**
```
SMTP_HOST          # 'mailpit' in local, real relay host in production
SMTP_PORT          # 1025 in local, 587 in production
SMTP_USERNAME      # empty in local
SMTP_PASSWORD      # empty in local
SMTP_FROM_ADDRESS
SMTP_TLS_ENABLED   # false in local, true in production
```

### 6.2 Email Events

| Event | Trigger | Recipient |
|-------|---------|-----------|
| Welcome | User registers | New user |
| Password Reset | Forgot-password request | Requesting user |
| 24h Prediction Reminder | Scheduled job, 24 h before lock-out | Users without a prediction for that match |
| Winner Announcement | Admin declares stage or tournament winner | All participants |
| Flash Challenge Announcement | Admin publishes a challenge | All eligible users |
| Duel Invitation | User sends duel challenge | Target user |
| Duel Result | Match confirmed, duel scored | Both duel participants |

### 6.3 Notification Abstraction

A generic `notifications` table and service layer is created in v1 to decouple notification delivery from business logic. Email is the only delivery channel in v1. Web push and mobile push are designed as **future channels** that require no schema changes to add.

**Notification record (see full schema in Section 10.1):**
```
id, user_id, type, title, body, channel, status, created_at, sent_at, metadata (jsonb)
```

---

## 7. Security Requirements

### 7.1 Authentication
- JWT-based authentication
- Access token stored in a **secure, httpOnly, SameSite=Strict cookie**
- Access token expiry: **15 minutes**
- Refresh token expiry: **7 days**, stored in an httpOnly cookie, rotated on each use
- Password hashing: **Argon2id**
- Password reset via short-lived signed token (expiry: **1 hour**)

### 7.2 Registration Restriction
- Self-registration is limited to users with an **approved email domain**
- Allowed domains configured via `ALLOWED_EMAIL_DOMAINS` (comma-separated)
  - Example: `ALLOWED_EMAIL_DOMAINS=company.com,partner.org`
- If `ALLOWED_EMAIL_DOMAINS` is empty, any email domain is accepted (development default)

### 7.3 Authorization

**Roles:**
- `user` — Default; can submit predictions, comments, duels, and flash challenge answers
- `admin` — Elevated; can access all admin APIs in addition to standard user features

**Admin assignment:**
- The first admin account is promoted via a one-time CLI command (`python seed.py --make-admin <email>`) or the seed script
- Subsequent admins are promoted via `PUT /api/admin/users/:id/role` by an existing admin
- Admins cannot demote themselves; another admin must execute the demotion
- **Admins cannot impersonate users**

### 7.4 Input Validation
- All inputs validated with typed Pydantic schemas on the backend
- Reject predictions after `lock_at`
- Reject negative scores or non-integer score values
- Reject duplicate duel challenges where one is already active
- Avatar MIME type allowed: `image/jpeg`, `image/png`, `image/webp`
- Avatar max file size: **2 MB**
- Avatar max dimensions: **2000 × 2000 px**
- Comment body max length: **500 characters** (enforced by DB CHECK and Pydantic)

### 7.5 Security Hardening
- CSRF protection on all state-changing endpoints (cookie-based auth)
- Rate limits:

  | Endpoint | Limit |
  |----------|-------|
  | POST /api/auth/login | 10 per IP per 15 min |
  | POST /api/auth/register | 5 per IP per hour |
  | POST /api/auth/forgot-password | 3 per email per hour |
  | POST comment | 5 per user per match per minute |
  | POST prediction | 20 per user per minute |

- Audit log for all sensitive admin mutations
- Input sanitization on comments and profile text fields (strip control characters, trim whitespace)
- Secure file upload: validate content type via file magic bytes, not only file extension
- SSL/TLS termination required in production via the `nginx` container (see Section 13.6)
- Secrets exclusively via environment variables; no credentials in codebase or Docker image layers

---

## 8. API Design Standards

### 8.1 Error Response Format

All API errors use this structure:

```json
{
  "error": {
    "code": "PREDICTION_LOCKED",
    "message": "This match is no longer accepting predictions.",
    "details": {}
  }
}
```

| HTTP Status | When |
|-------------|------|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error or bad request |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate prediction, duplicate duel) |
| 422 | Schema mismatch (Pydantic validation failure) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

### 8.2 Pagination Standard

All list endpoints returning potentially large collections use **cursor-based pagination**.

**Request parameters:**
- `limit` — Integer, default `20`, max `100`
- `cursor` — Opaque string; omit for the first page

**Response envelope:**
```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "...",
    "has_more": true
  }
}
```

### 8.3 Endpoint Inventory

**Auth**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET  /api/auth/me`

**Profile**
- `GET  /api/me/profile`
- `PUT  /api/me/profile`
- `POST /api/me/avatar`
- `GET  /api/me/predictions`
- `GET  /api/me/duels`
- `GET  /api/me/challenges`

**Matches & Predictions**
- `GET  /api/tournaments/:id/matches`
- `GET  /api/matches/:id`
- `POST /api/matches/:id/prediction`
- `PUT  /api/matches/:id/prediction`

**Leaderboards**
- `GET  /api/leaderboards/global`
- `GET  /api/leaderboards/tournament/:id`
- `GET  /api/leaderboards/stage/:id`

**Social**
- `GET    /api/matches/:id/comments`
- `POST   /api/matches/:id/comments`
- `PUT    /api/comments/:id`
- `DELETE /api/comments/:id`

**Duels**
- `POST /api/matches/:id/duels`
- `POST /api/duels/:id/accept`
- `POST /api/duels/:id/decline`

**Flash Challenges**
- `GET  /api/challenges/active`
- `POST /api/challenges/:id/answer`

**Admin — Settings**
- `PUT /api/admin/settings/lockout`

**Admin — Matches**
- `POST /api/admin/sync/matches`
- `PUT  /api/admin/matches/:id/result`
- `POST /api/admin/matches/:id/recalculate`

**Admin — Stages**
- `POST /api/admin/stages/:id/freeze`

**Admin — Flash Challenges**
- `POST /api/admin/challenges`
- `PUT  /api/admin/challenges/:id`
- `POST /api/admin/challenges/:id/resolve`
- `DELETE /api/admin/challenges/:id`

**Admin — Users & Support**
- `GET  /api/admin/users/:id`
- `PUT  /api/admin/users/:id/role`
- `POST /api/admin/users/:id/reset-password`
- `POST /api/admin/users/:id/resend-email`
- `POST /api/admin/users/:id/unlock`

**Admin — Comments**
- `DELETE /api/admin/comments/:id`

**Admin — Audit & Prizes**
- `GET  /api/admin/audit-logs`
- `POST /api/admin/prizes`
- `PUT  /api/admin/prizes/:id`

**System**
- `GET /api/health`
- `GET /api/health/ready`

---

## 9. Data Model

### 9.1 Table Definitions

**users**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
email         TEXT        NOT NULL UNIQUE
password_hash TEXT        NOT NULL
role          TEXT        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('user', 'admin'))
is_active     BOOLEAN     NOT NULL DEFAULT TRUE
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**user_profiles**
```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
display_name      TEXT        NOT NULL
avatar_path       TEXT
bio               TEXT
favorite_team_id  UUID        REFERENCES teams(id)
total_points      INTEGER     NOT NULL DEFAULT 0
exact_hits        INTEGER     NOT NULL DEFAULT 0
outcome_hits      INTEGER     NOT NULL DEFAULT 0
duel_wins         INTEGER     NOT NULL DEFAULT 0
duel_losses       INTEGER     NOT NULL DEFAULT 0
duel_draws        INTEGER     NOT NULL DEFAULT 0
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**tournaments**
```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT        NOT NULL
season      TEXT        NOT NULL
status      TEXT        NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming', 'active', 'completed'))
external_id TEXT        UNIQUE
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**teams**
```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT        NOT NULL
short_code  TEXT
flag_url    TEXT
external_id TEXT        UNIQUE
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**stages**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id UUID        NOT NULL REFERENCES tournaments(id)
name          TEXT        NOT NULL
order_index   INTEGER     NOT NULL
is_frozen     BOOLEAN     NOT NULL DEFAULT FALSE
frozen_at     TIMESTAMPTZ
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**matches**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id UUID        NOT NULL REFERENCES tournaments(id)
stage_id      UUID        NOT NULL REFERENCES stages(id)
home_team_id  UUID        NOT NULL REFERENCES teams(id)
away_team_id  UUID        NOT NULL REFERENCES teams(id)
kickoff_utc   TIMESTAMPTZ NOT NULL
lock_at       TIMESTAMPTZ NOT NULL
venue         TEXT
status        TEXT        NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN (
                            'scheduled','live','finished',
                            'confirmed','postponed','cancelled'
                          ))
external_id   TEXT        UNIQUE
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**match_results**
```sql
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
match_id     UUID        NOT NULL UNIQUE REFERENCES matches(id)
home_score   INTEGER     NOT NULL
away_score   INTEGER     NOT NULL
is_override  BOOLEAN     NOT NULL DEFAULT FALSE
confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
confirmed_by UUID        REFERENCES users(id)
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**predictions**
```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID        NOT NULL REFERENCES users(id)
match_id    UUID        NOT NULL REFERENCES matches(id)
home_score  INTEGER     NOT NULL CHECK (home_score >= 0)
away_score  INTEGER     NOT NULL CHECK (away_score >= 0)
points      INTEGER
result_type TEXT        CHECK (result_type IN ('exact', 'outcome', 'miss'))
submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (user_id, match_id)
```

**flash_challenges**
```sql
id                UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id     UUID        NOT NULL REFERENCES tournaments(id)
match_id          UUID        REFERENCES matches(id)
stage_id          UUID        REFERENCES stages(id)
scope             TEXT        NOT NULL CHECK (scope IN ('match', 'stage'))
title             TEXT        NOT NULL
description       TEXT
type              TEXT        NOT NULL CHECK (type IN ('yes_no', 'multiple_choice'))
points_value      INTEGER     NOT NULL DEFAULT 1
open_at           TIMESTAMPTZ NOT NULL
close_at          TIMESTAMPTZ NOT NULL
resolution_method TEXT        NOT NULL
                  CHECK (resolution_method IN ('manual', 'automatic'))
correct_option_id UUID        REFERENCES flash_challenge_options(id)
resolved_at       TIMESTAMPTZ
status            TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','open','closed','resolved','cancelled'))
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**flash_challenge_options**
```sql
id           UUID        PRIMARY KEY DEFAULT gen_random_uuid()
challenge_id UUID        NOT NULL REFERENCES flash_challenges(id) ON DELETE CASCADE
label        TEXT        NOT NULL
order_index  INTEGER     NOT NULL DEFAULT 0
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**flash_challenge_answers**
```sql
id             UUID        PRIMARY KEY DEFAULT gen_random_uuid()
challenge_id   UUID        NOT NULL REFERENCES flash_challenges(id)
user_id        UUID        NOT NULL REFERENCES users(id)
option_id      UUID        NOT NULL REFERENCES flash_challenge_options(id)
points_awarded INTEGER
submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (challenge_id, user_id)
```

**duel_challenges**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
match_id      UUID        NOT NULL REFERENCES matches(id)
challenger_id UUID        NOT NULL REFERENCES users(id)
opponent_id   UUID        NOT NULL REFERENCES users(id)
status        TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending','accepted','declined','expired','scored'
                          ))
winner_id     UUID        REFERENCES users(id)
is_draw       BOOLEAN     NOT NULL DEFAULT FALSE
expires_at    TIMESTAMPTZ NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE (match_id, challenger_id, opponent_id)
```

**comments**
```sql
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid()
match_id    UUID        NOT NULL REFERENCES matches(id)
user_id     UUID        NOT NULL REFERENCES users(id)
body        TEXT        NOT NULL CHECK (char_length(body) <= 500)
is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE
deleted_by  UUID        REFERENCES users(id)
deleted_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**prizes**
```sql
id              UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id   UUID        NOT NULL REFERENCES tournaments(id)
stage_id        UUID        REFERENCES stages(id)
title           TEXT        NOT NULL
description     TEXT
winner_user_id  UUID        REFERENCES users(id)
awarded_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**leaderboard_snapshots**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
tournament_id UUID        NOT NULL REFERENCES tournaments(id)
stage_id      UUID        REFERENCES stages(id)
scope         TEXT        NOT NULL CHECK (scope IN ('global', 'tournament', 'stage'))
snapshot_data JSONB       NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**notifications**
```sql
id         UUID        PRIMARY KEY DEFAULT gen_random_uuid()
user_id    UUID        NOT NULL REFERENCES users(id)
type       TEXT        NOT NULL
title      TEXT        NOT NULL
body       TEXT        NOT NULL
channel    TEXT        NOT NULL DEFAULT 'email'
                       CHECK (channel IN ('email', 'push', 'in_app'))
status     TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'sent', 'failed'))
metadata   JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
sent_at    TIMESTAMPTZ
```

**outbound_email_jobs**
```sql
id              UUID        PRIMARY KEY DEFAULT gen_random_uuid()
notification_id UUID        REFERENCES notifications(id)
to_address      TEXT        NOT NULL
subject         TEXT        NOT NULL
body            TEXT        NOT NULL
status          TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending','sent','failed','dead_letter'
                            ))
attempts        INTEGER     NOT NULL DEFAULT 0
last_attempt_at TIMESTAMPTZ
next_attempt_at TIMESTAMPTZ
error_log       TEXT
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**audit_logs**
```sql
id            UUID        PRIMARY KEY DEFAULT gen_random_uuid()
actor_id      UUID        REFERENCES users(id)
action        TEXT        NOT NULL
resource_type TEXT
resource_id   UUID
before_state  JSONB
after_state   JSONB
ip_address    TEXT
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### 9.2 Indexes

```sql
-- Predictions
CREATE INDEX idx_predictions_user_id    ON predictions(user_id);
CREATE INDEX idx_predictions_match_id   ON predictions(match_id);
CREATE INDEX idx_predictions_submitted  ON predictions(submitted_at);

-- Matches
CREATE INDEX idx_matches_tournament_id  ON matches(tournament_id);
CREATE INDEX idx_matches_stage_id       ON matches(stage_id);
CREATE INDEX idx_matches_kickoff_utc    ON matches(kickoff_utc);
CREATE INDEX idx_matches_status         ON matches(status);

-- Comments
CREATE INDEX idx_comments_match_id      ON comments(match_id);
CREATE INDEX idx_comments_user_id       ON comments(user_id);
CREATE INDEX idx_comments_created_at    ON comments(created_at);

-- Duels
CREATE INDEX idx_duels_challenger_id    ON duel_challenges(challenger_id);
CREATE INDEX idx_duels_opponent_id      ON duel_challenges(opponent_id);
CREATE INDEX idx_duels_match_id         ON duel_challenges(match_id);
CREATE INDEX idx_duels_status           ON duel_challenges(status);

-- Flash challenges
CREATE INDEX idx_flash_match_id         ON flash_challenges(match_id);
CREATE INDEX idx_flash_stage_id         ON flash_challenges(stage_id);
CREATE INDEX idx_flash_answers_challenge ON flash_challenge_answers(challenge_id);
CREATE INDEX idx_flash_answers_user     ON flash_challenge_answers(user_id);

-- Email jobs
CREATE INDEX idx_email_jobs_status      ON outbound_email_jobs(status);
CREATE INDEX idx_email_jobs_next_attempt ON outbound_email_jobs(next_attempt_at)
  WHERE status = 'pending';

-- Audit logs
CREATE INDEX idx_audit_actor_id         ON audit_logs(actor_id);
CREATE INDEX idx_audit_created_at       ON audit_logs(created_at);
```

---

## 10. Performance & Reliability Targets

| Metric | Target |
|--------|--------|
| API p95 response time (DB-backed) | < 300 ms |
| Leaderboard page load (Redis-cached) | < 100 ms |
| Concurrent users (v1) | ≥ 200 |
| Result processing latency after match confirmation | < 5 minutes |
| Email delivery latency (first attempt) | < 60 seconds |
| Background job max retry attempts | 5 |
| External API sync interval (default) | 5 minutes |

**Reliability requirements:**
- DB connection pooling with retry on startup
- Containers use `restart: unless-stopped`
- Startup order does not assume DB or Redis are instantly ready; each service polls until connected
- The `migrations` container completes and exits before the `web` container accepts traffic
- All background jobs are idempotent; at-least-once delivery is safe

---

## 11. Frontend Requirements

### 11.1 Screen and Route Inventory

| Screen | Route |
|--------|-------|
| Login | `/login` |
| Register | `/register` |
| Forgot Password | `/forgot-password` |
| Reset Password | `/reset-password` |
| Home Dashboard | `/` |
| Tournament Overview | `/tournaments/:id` |
| Match List | `/tournaments/:id/matches` |
| Match Detail & Prediction | `/matches/:id` |
| Match Lounge (comments) | `/matches/:id/lounge` |
| Leaderboard | `/leaderboard` |
| Duel Center | `/duels` |
| Flash Challenge Center | `/challenges` |
| Profile | `/profile` |
| Admin Dashboard | `/admin` |
| Admin Match Management | `/admin/matches` |
| Admin Flash Challenges | `/admin/challenges` |
| Admin User Management | `/admin/users` |
| Admin Audit Logs | `/admin/audit-logs` |

### 11.2 Responsive Breakpoints

| Name | Min Width | Primary Target |
|------|-----------|----------------|
| `xs` | 320 px | Small phones |
| `sm` | 390 px | Standard phones |
| `md` | 768 px | Tablets |
| `lg` | 1024 px | Small desktops |
| `xl` | 1280 px | Desktops |

### 11.3 UX Requirements
- Fully usable at 320 px: no horizontal overflow, no clipped controls, no horizontal scroll on standard app pages
- Tap targets minimum **44 × 44 px** on mobile
- Sticky bottom actions on mobile where appropriate
- Skeleton loading states for all async data
- Countdown timer to lock-out displayed on match cards and prediction forms
- Lock/open state badges on match cards
- Dark mode supported (respects OS `prefers-color-scheme`)
- Favorite team provides subtle UI accenting (color chip or small flag) — not a full theme takeover
- Accessible forms: aria labels, keyboard navigation, visible focus states
- No hard-coded UI strings; component text must come from a constants file to support future localization

---

## 12. Business Logic Details

### 12.1 Result Processing Flow

When a match is confirmed:
1. Fetch all predictions for the match
2. For each prediction, call `calculate_points()`
3. Write `points` and `result_type` to the `predictions` row
4. Upsert `user_profiles.total_points`, `exact_hits`, `outcome_hits`
5. Resolve all `accepted` duels for this match (Section 12.2)
6. Resolve any `automatic` flash challenges linked to this match (if supported)
7. Invalidate Redis leaderboard cache entries for affected tournament and stage
8. Enqueue notification jobs (winner announcements, duel results) as applicable
9. Append an entry to `audit_logs`

**Idempotency:** Before writing, check whether the prediction already has the same `points` and `result_type` for the current result. If unchanged, skip the write. Re-runs produce no side effects.

### 12.2 Duel Resolution

Triggered by step 5 of the result processing flow:
1. Find all duels for this match with status `accepted`
2. For each duel, look up both users' predictions for the match
3. Calculate points for each user via `calculate_points()`
4. If user A has more points: set `winner_id = A`, `status = scored`
5. If user B has more points: set `winner_id = B`, `status = scored`
6. If tied: set `is_draw = TRUE`, `status = scored`, `winner_id = NULL`
7. If a user had no prediction: they receive 0 points; the other user wins unless also 0
8. Increment win/loss/draw counters on both `user_profiles` rows
9. Enqueue duel result notification for both users

### 12.3 Comment Grace Period Enforcement
- Edit and delete are permitted only when `NOW() - comment.created_at <= 5 minutes`
- Config key: `COMMENT_GRACE_PERIOD_MINUTES` (default: 5)
- The server evaluates this at request time; the client-side countdown is informational only
- Admin deletions bypass the grace period check

### 12.4 Admin Support Tools

Admins may perform these actions on user accounts without impersonating the user:

| Action | Endpoint |
|--------|----------|
| View user profile and participation status | `GET /api/admin/users/:id` |
| Resend welcome or reminder email | `POST /api/admin/users/:id/resend-email` |
| Trigger password reset on behalf of user | `POST /api/admin/users/:id/reset-password` |
| Unlock rate-limited or suspended account | `POST /api/admin/users/:id/unlock` |
| View audit log entries for a specific user | `GET /api/admin/audit-logs?user_id=:id` |
| Promote or demote admin role | `PUT /api/admin/users/:id/role` |

---

## 13. DevOps & Deployment

### 13.1 Docker Compose Container Startup Order
- `db` must reach healthy state before `migrations`, `web`, and `worker` start
- `redis` must reach healthy state before `worker` and `scheduler` start
- `migrations` must exit with code 0 before `web` starts accepting traffic

### 13.2 Named Volumes
| Volume | Used by |
|--------|---------|
| `db_data` | PostgreSQL data persistence |
| `avatars` | Uploaded avatar images (local storage default) |

### 13.3 Environment Variables Template

Key variables in `.env.example`:
```
# Database
DATABASE_URL=postgresql://user:pass@db:5432/tournament_hub

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Auth
ALLOWED_EMAIL_DOMAINS=company.com

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=noreply@company.com
SMTP_TLS_ENABLED=true

# External soccer API
SOCCER_API_KEY=
SOCCER_API_PROVIDER=football-data

# App
APP_ENV=production
APP_SECRET_KEY=
CORS_ORIGINS=https://your-domain.com

# Feature config
DUEL_INVITE_EXPIRY_HOURS=24
COMMENT_GRACE_PERIOD_MINUTES=5
DEFAULT_LOCKOUT_HOURS=1

# Avatar storage
AVATAR_STORAGE=local   # or 's3'
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### 13.4 Health Check Endpoints
- `GET /api/health` — Returns `{"status": "ok", "db": "ok", "redis": "ok"}`
- `GET /api/health/ready` — Returns 200 only when migrations are complete and DB is connected
- `GET /` (frontend) — Returns 200

### 13.5 Backup Guidance
- PostgreSQL: scheduled `pg_dump` via host cron or a sidecar container, written to a mounted backup volume
- Retention: 7 daily dumps, 4 weekly dumps
- Avatar volume: back up the `avatars` named volume on the same schedule

### 13.6 Nginx Configuration

Nginx runs as a container inside Docker Compose and is the **only** service with ports exposed to the host (`80` and `443`). All other containers are on an internal Docker network.

**Routing rules:**

| Upstream path | Proxied to |
|---------------|------------|
| `/api/*` | `http://web:8000` |
| `/_next/static/*` | Static file volume (served directly by Nginx) |
| `/*` | `http://frontend:3000` |

**Required Nginx settings:**
- TLS 1.2 minimum (`ssl_protocols TLSv1.2 TLSv1.3`)
- HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- `server_tokens off`
- Gzip compression for text/html, application/json, text/css, application/javascript
- `client_max_body_size 5m` (covers avatar uploads)
- Proxy headers: `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto`
- HTTP → HTTPS redirect on port 80

**SSL certificates:**
- Provisioned via **Certbot** (`certbot/certbot` Docker image) using the Linode DNS or webroot challenge
- Certificates stored in a named volume `certbot_certs` mounted into the `nginx` container
- Renewal handled by a host cron job or a Certbot renewal sidecar

**Local development:**
- Nginx is included in `docker-compose.yml` but uses a self-signed certificate (generated at startup)
- Alternatively, developers can bypass Nginx and hit `web` and `frontend` ports directly

### 13.7 Linode Deployment Notes
- Install Docker and Docker Compose on Ubuntu
- Point domain A record to Linode IP before running Certbot
- Run Certbot to issue certificate; confirm `nginx` container mounts the cert volume
- Test HTTPS end-to-end before going live
- Store secrets in a `.env` file on the server — never commit it to version control
- All containers: `restart: unless-stopped`

---

## 14. Observability

- **Structured logs:** JSON format for all application logs
- **Request logging:** method, path, status code, latency for every request
- **Job logging:** job type, attempt count, outcome per run
- **Admin action audit logging:** all admin mutations written to `audit_logs`
- **Error responses:** consistent error codes with human-readable messages (see Section 8.1)
- **Health endpoints:** see Section 13.4
- **Metrics-ready design:** log fields are compatible with a future Prometheus/Grafana integration; stub a `/metrics` endpoint that returns 200 and can be expanded later

---

## 15. Testing Requirements

### 15.1 Unit Tests
- `calculate_lock_at()` — correct offset, boundary at exact lock-at second
- `is_prediction_editable()` — before, at, and after lock-at
- `calculate_points()` — exact score, correct outcome, miss
- `calculate_points()` — metadata fields present and correct
- Tie-breaker ordering — all five levels exercised
- Duel resolution — win, loss, draw, missing prediction
- Flash challenge resolution — yes/no, multiple choice
- Comment grace period — inside window, at boundary, outside window

### 15.2 Integration Tests

| Test Case | Expected Result |
|-----------|----------------|
| Register with valid email domain | User created |
| Register with blocked email domain | 403 |
| Login → access token cookie set | 200, cookie present |
| Refresh → new token issued, old invalidated | 200 |
| Logout → token invalidated | 200 |
| Forgot password → reset link issued | 200 |
| Reset password with valid token | Password updated |
| Reset password with expired token | 400 |
| Submit prediction before lock-at | 201 |
| Submit prediction after lock-at | 400 PREDICTION_LOCKED |
| Edit prediction before lock-at | 200 |
| Edit prediction after lock-at | 400 PREDICTION_LOCKED |
| Submit duplicate prediction | 409 |
| Global leaderboard respects tie-breaking order | Correct order verified |
| Stage leaderboard after freeze call | Returns snapshot; live changes excluded |
| Edit comment within grace period | 200 |
| Edit comment after grace period | 403 |
| Admin deletes any comment | 200 |
| User deletes another user's comment | 403 |
| Non-admin accesses admin endpoint | 403 |
| Full duel lifecycle: send → accept → score | All status transitions correct |
| Duel expires without acceptance | Status = expired |
| Accept expired duel | 400 |
| Flash challenge answer before close_at | 201 |
| Flash challenge answer after close_at | 400 |
| Admin resolves flash challenge; points awarded | Points assigned to correct answers |

### 15.3 Test Fixtures

Provide pytest fixtures covering:
- 2 users (1 regular, 1 admin) with full profiles
- 1 tournament with 3 stages
- 8 teams
- 6 matches: 2 upcoming, 2 locked, 2 confirmed with results
- Predictions in all states (scored, unscored, missing)
- 1 active duel, 1 expired duel
- 2 flash challenges: 1 open, 1 resolved
- 10 sample comments across 2 matches

---

## 16. Seed Data & Demo Flow

The seed script must make the system **fully demonstrable immediately after `docker compose up`**.

| Data | Quantity |
|------|---------|
| Demo tournament | 1 (World Cup 2026) |
| Teams | 8 |
| Stages | 3 (Group Stage, Quarterfinals, Final) |
| Matches | 6 (2 upcoming, 2 locked, 2 confirmed with results) |
| Demo users | 5 (1 admin: `admin@company.com`, 4 regular users) |
| Predictions | All 5 users across both confirmed matches |
| Comments | 10 spread across 2 matches |
| Flash challenges | 2 (1 open yes/no, 1 resolved multiple choice) |
| Duels | 2 (1 accepted and scored, 1 pending) |
| Prizes | 1 prize defined for tournament winner |

Admin credentials and demo user passwords must be documented in the README under a "Demo login" section.

---

## 17. Folder Structure (Reference)

### Backend (`/backend`)
```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── matches.py
│   │       ├── predictions.py
│   │       ├── leaderboards.py
│   │       ├── comments.py
│   │       ├── duels.py
│   │       ├── challenges.py
│   │       ├── profile.py
│   │       └── admin/
│   │           ├── matches.py
│   │           ├── challenges.py
│   │           ├── users.py
│   │           ├── stages.py
│   │           └── settings.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── dependencies.py
│   ├── db/
│   │   ├── models.py
│   │   └── session.py
│   ├── services/
│   │   ├── scoring.py
│   │   ├── lockout.py
│   │   ├── leaderboard.py
│   │   ├── result_processing.py
│   │   ├── notifications.py
│   │   ├── soccer_api/
│   │   │   ├── base.py
│   │   │   └── football_data.py
│   │   └── email/
│   │       ├── sender.py
│   │       └── templates/
│   │           ├── welcome.txt
│   │           ├── password_reset.txt
│   │           ├── prediction_reminder.txt
│   │           ├── winner_announcement.txt
│   │           ├── flash_challenge_announcement.txt
│   │           ├── duel_invitation.txt
│   │           └── duel_result.txt
│   ├── jobs/
│   │   ├── sync_matches.py
│   │   ├── process_results.py
│   │   ├── send_reminders.py
│   │   └── expire_duels.py
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── matches.py
│   │   ├── predictions.py
│   │   ├── leaderboards.py
│   │   ├── comments.py
│   │   ├── duels.py
│   │   ├── challenges.py
│   │   └── profile.py
│   └── migrations/
│       └── versions/
├── tests/
│   ├── unit/
│   │   ├── test_scoring.py
│   │   ├── test_lockout.py
│   │   ├── test_tiebreaker.py
│   │   └── test_duel_resolution.py
│   ├── integration/
│   │   ├── test_auth.py
│   │   ├── test_predictions.py
│   │   ├── test_leaderboard.py
│   │   ├── test_comments.py
│   │   ├── test_duels.py
│   │   ├── test_challenges.py
│   │   └── test_admin.py
│   └── fixtures.py
├── Dockerfile
├── requirements.txt
└── seed.py
```

### Frontend (`/frontend`)
```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (main)/
│   │   ├── page.tsx                    # Dashboard
│   │   ├── tournaments/[id]/page.tsx
│   │   ├── tournaments/[id]/matches/page.tsx
│   │   ├── matches/[id]/page.tsx
│   │   ├── matches/[id]/lounge/page.tsx
│   │   ├── leaderboard/page.tsx
│   │   ├── duels/page.tsx
│   │   ├── challenges/page.tsx
│   │   └── profile/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── matches/page.tsx
│   │   ├── challenges/page.tsx
│   │   ├── users/page.tsx
│   │   └── audit-logs/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                             # Generic reusable components
│   ├── match/
│   ├── prediction/
│   ├── leaderboard/
│   ├── duel/
│   ├── challenge/
│   └── admin/
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── utils.ts
├── types/
├── constants/                          # All UI strings go here for future i18n
├── public/
├── Dockerfile
└── package.json
```

---

## 18. Fixed Product Decisions

These decisions are final and must not be revisited without an explicit change request and document update.

| Topic | Decision |
|-------|---------|
| Authentication method | Local JWT only; no SSO, OAuth, or social login |
| Registration | Self-service, limited to configured email domains |
| Comment moderation | No pre-approval; post-publish moderation by admins only |
| Leaderboard structure | One global + per-stage; stage boards frozen on finalization |
| Prediction editing | Allowed up to lock-at; read-only after |
| Admin impersonation | Not permitted |
| Language | English only in v1 |
| Push notifications | Not in v1; architecture supports future addition via `notifications` table |
| Duel expiry | Default 24 h; configurable via `DUEL_INVITE_EXPIRY_HOURS` |
| Email format | Plain text only; no HTML |
| Admin promotion | CLI/seed for first admin; admin API for subsequent promotions |
| UI strings | Stored in `constants/`; no hard-coded user-facing text in components |
| Tournament reuse | Architecture supports multiple future tournaments without schema redesign |
| Flash challenge scope | Both `match` and `stage` scopes supported in v1 |
| Scoring extensibility | `ScoringConfig` struct exists in v1; advanced modes disabled by default |
