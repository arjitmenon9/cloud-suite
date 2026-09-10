# Cloud Computing Suite

A small set of independently deployed services, built to demonstrate several
distinct cloud computing primitives rather than just one CRUD app. Companion
to [`todo-app`](https://github.com/arjitmenon9/todo-app), which covers a
Postgres-backed web service on its own.

| Service | What it demonstrates | Backing store | Hosted on |
|---|---|---|---|
| [`utility-hub`](./utility-hub) | Always-on web service: URL shortener + a small read API | Redis (Render Key Value) | Render (free web service) |
| [`stats-cron`](./stats-cron) | Scheduled/serverless-style compute — runs on a timer, not continuously | Same Redis, written to | **GitHub Actions** scheduled workflow (Render Cron Jobs require a paid plan — this gets the same "runs on a timer, no server to keep alive" concept for $0) |
| [`portfolio`](./portfolio) | Static hosting + CDN, client-side monitoring of the other two | none (static) | Render (free static site) |

Live: **portfolio** ties it together — see its card for links, or:
- `utility-hub`: shorten a URL with `POST /api/shorten {"url": "..."}`, then
  visit the returned `shortUrl`.
- `stats-cron` writes a "digest" (GitHub stars/forks/issues) to Redis on a
  schedule; `utility-hub` serves it at `GET /api/digest`. It tracks this repo
  (`cloud-suite`) rather than the private `todo-app` repo, since the
  unauthenticated GitHub API call it makes (no token, to stay free/simple)
  returns 404 for private repos.

## Why split it up this way

Each service is deployed and scaled independently, has its own Dockerfile
and CI job, and uses the storage type that actually fits it: `utility-hub`
needs fast key lookups (Redis), not a relational schema. `stats-cron` isn't
a server at all — it runs, does one thing, and exits, which is exactly what
a scheduled job (Render Cron Job, AWS Lambda + EventBridge, GCP Cloud
Scheduler, etc.) is for. It runs as a GitHub Actions scheduled workflow here
specifically because Render's own Cron Job resource requires a paid plan —
same architectural pattern, zero cost. `portfolio` needs no server at all.

## Local development

```bash
docker compose up --build          # starts utility-hub + Redis
docker compose run --rm stats-cron # runs the cron job once, ad hoc
```

Open `portfolio/index.html` directly in a browser (it's static — no server
needed) once `UTILITY_HUB_URL` inside it points at a running instance.

## Testing

Both `utility-hub` and `stats-cron` need a real Redis reachable at
`REDIS_URL` for their tests (no mocking the data layer — same philosophy as
`todo-app`'s Postgres tests):

```bash
cd utility-hub && REDIS_URL=redis://localhost:6379 REDIS_TLS=false npm test
cd stats-cron  && REDIS_URL=redis://localhost:6379 REDIS_TLS=false npm test
```

CI runs both test suites against a real Redis service container, then
builds and validates both Docker images, on every push/PR to `main`.

## Infrastructure

See [`terraform/`](./terraform) for this suite's infrastructure as code
(Render Key Value store + web service + cron job).

## Known limitation from development

`stats-cron`'s real GitHub API call couldn't be exercised end-to-end from
inside the sandbox this was built in — that sandbox blocks `api.github.com`
repo lookups by policy, unrelated to Render's environment. It's covered
instead by unit tests with a mocked fetch, and was verified for real once
deployed (see the project's progress notes).
