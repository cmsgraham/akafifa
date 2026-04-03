# AkaFifa — World Cup Prediction Tournament

A real-time World Cup prediction platform where users compete by predicting match outcomes, participating in flash challenges, and engaging in head-to-head duels.

## Tech Stack

| Layer       | Technology                              |
| ----------- | --------------------------------------- |
| Backend     | FastAPI · Python 3.12 · SQLAlchemy      |
| Frontend    | Next.js 14 · TypeScript · Tailwind CSS  |
| Database    | PostgreSQL 16 · Redis 7                 |
| Infra       | Docker Compose · Nginx 1.27 · Certbot   |
| Background  | RQ (Redis Queue)                        |
| Auth        | JWT (httpOnly cookies) · Argon2id       |

## Prerequisites

- Docker & Docker Compose v2
- Git

## Local Development

```bash
# 1. Clone and enter the project
git clone git@github.com:cmsgraham/akafifa.git
cd akafifa

# 2. Copy environment variables
cp .env.example .env

# 3. Start all services (dev mode with hot-reload)
docker compose up --build

# 4. Run initial database migration
docker compose exec web alembic upgrade head
```

### Services available locally

| Service     | URL                          |
| ----------- | ---------------------------- |
| Frontend    | http://localhost:3000        |
| Backend API | http://localhost:8000        |
| API Docs    | http://localhost:8000/docs   |
| Mailpit     | http://localhost:8025        |
| PostgreSQL  | localhost:5432               |
| Redis       | localhost:6379               |

### Running Tests

```bash
# Backend unit tests
docker compose exec web pytest tests/unit -v

# Backend integration tests
docker compose exec web pytest tests/integration -v
```

### Creating a Database Migration

```bash
docker compose exec web alembic revision --autogenerate -m "describe your change"
docker compose exec web alembic upgrade head
```

## Production Deployment (Linode)

Target server: `172.238.203.151` (Ubuntu)

```bash
# 1. SSH into the server
ssh root@172.238.203.151

# 2. Clone the repo
git clone git@github.com:cmsgraham/akafifa.git /opt/akafifa
cd /opt/akafifa

# 3. Create .env from the example and fill in production values
cp .env.example .env
# Edit .env: set APP_ENV=production, real JWT_SECRET_KEY, production DB creds,
# SMTP credentials for your relay, SOCCER_API_KEY, etc.

# 4. Start in production mode (no override file)
docker compose -f docker-compose.yml up -d --build

# 5. Run migrations
docker compose exec web alembic upgrade head

# 6. Provision SSL with Certbot
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com

# 7. Uncomment the HTTPS server block in nginx/conf.d/default.conf
# 8. Reload nginx
docker compose exec nginx nginx -s reload
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/         # Route handlers
│   │   ├── core/           # Config, security, dependencies
│   │   ├── db/             # Models, session
│   │   ├── jobs/           # Background job definitions
│   │   ├── migrations/     # Alembic migrations
│   │   └── services/       # Business logic (scoring, lockout, email, soccer API)
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/                # Next.js App Router pages
│   ├── lib/                # API client
│   ├── constants/          # i18n strings
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf
│   └── conf.d/default.conf
├── docker-compose.yml
├── docker-compose.override.yml  # Dev-only (Mailpit, exposed ports)
└── .env.example
```

## License

Private — All rights reserved.
