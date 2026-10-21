# Cloud Computing Suite: Technical Design Document

**Course:** Cloud Computing and DevOps (CSE 3130), Mini Project
**Team:** Arjit Menon, Dhruvishi, Arisha, Manya Vishwanath, Swasti
**Source repository:** https://github.com/arjitmenon9/cloud-suite

---

## 1. Introduction

Cloud Computing Suite is a set of three small, independently deployed services
that together show several core cloud and DevOps ideas in one working system:

- **utility-hub**: an always-on web service (URL shortener plus a small read API)
- **stats-cron**: a scheduled job that runs on a timer, does one task, and exits
- **portfolio**: a static website that monitors the other services live from the browser

Each service is containerised with Docker, tested automatically in a CI/CD
pipeline, described as Infrastructure as Code with Terraform, and hosted on
free-tier cloud services.

## 2. Problem Statement

Student cloud projects are often a single CRUD app on one server, which shows
only one deployment pattern. Real cloud systems combine different compute
models (always-on services, scheduled or serverless jobs, static hosting) and
pick the storage that fits each job. They also depend on automation:
reproducible infrastructure, automated testing, and repeatable deployments.

The goal of this project was to design, build and deploy a small system that:

1. Uses at least four managed cloud services and tools.
2. Shows three different compute models: a web service, scheduled compute and static hosting.
3. Is fully automated through CI/CD and Infrastructure as Code.
4. Costs nothing to run, using only free tiers.

## 3. Solution Architecture

```
                         ┌──────────────────────────────┐
   User's browser ─────► │ portfolio (Render Static Site│
        │                │ + CDN) — status dashboard    │
        │                └──────────────┬───────────────┘
        │  POST /api/shorten            │ fetch /health, /api/digest
        ▼                               ▼
 ┌──────────────────────────────────────────────┐
 │ utility-hub (Render Web Service, Docker/Node)│
 │  URL shortener · /api/digest · /metrics      │
 └──────────────────────┬───────────────────────┘
                        │ read / write
                        ▼
          ┌──────────────────────────────┐
          │ Redis (Render Key Value,     │
          │ managed, TLS)                │
          └──────────────▲───────────────┘
                         │ writes digest:latest
 ┌───────────────────────┴──────────────────────┐
 │ stats-cron (GitHub Actions scheduled workflow│
 │ every 6 hours) ──► GitHub REST API           │
 └──────────────────────────────────────────────┘

 GitHub repo ──push──► GitHub Actions CI (tests on real Redis + Docker builds)
             └──────► Render auto-deploy
 Terraform ──────────► Render provider (Redis, web service, static site)
```

### Cloud services and tools used

| # | Service / tool | Category | Purpose in the project |
|---|---|---|---|
| 1 | Render Web Service | PaaS compute | Hosts utility-hub as an always-on Node.js service |
| 2 | Render Key Value (Redis) | Managed database | Fast key-value storage for short URLs, click counts and digests |
| 3 | Render Static Site | Static hosting + CDN | Serves the portfolio dashboard |
| 4 | GitHub Actions (CI) | CI/CD pipeline | Runs tests against a real Redis and builds Docker images on every push or PR |
| 5 | GitHub Actions (scheduled) | Scheduled / serverless-style compute | Runs stats-cron every 6 hours with no server to keep alive |
| 6 | Terraform (Render provider) | Infrastructure as Code | Defines the Redis store, web service and static site as code |
| 7 | Docker / Docker Compose | Containerisation | Reproducible images and a one-command local environment |
| 8 | Prometheus client + pino | Observability | `/metrics` endpoint and structured JSON logs |

### Key architectural decisions

- **Redis instead of a relational database.** The shortener only needs fast
  lookups by key (`url:<code>`), so a key-value store fits better than a
  relational schema.
- **GitHub Actions instead of a Render Cron Job.** Render's cron jobs need a
  paid plan. A scheduled GitHub Actions workflow follows the same pattern (run
  on a timer, then exit) at no cost. The same design would map to AWS Lambda
  with EventBridge, or GCP Cloud Scheduler.
- **Independent services.** Each service has its own Dockerfile, CI job and
  deployment, so each can be changed, scaled or redeployed on its own.
- **Free-tier only.** Every resource uses a free plan, as the project
  guidelines' budget caution requires.

## 4. Application Architecture

### 4.1 utility-hub (Node.js 20, Express)

| Endpoint | Method | Description |
|---|---|---|
| `/api/shorten` | POST | Body `{"url": "..."}`. Validates the URL, generates a 7-character `nanoid` code, stores it in Redis and returns `shortUrl` |
| `/:code` | GET | Redirects to the original URL and increments the click counter |
| `/api/stats/:code` | GET | Returns the original URL and its click count |
| `/api/digest` | GET | Returns the latest digest written by stats-cron |
| `/health` | GET | Pings Redis. Returns `ok` or `503 degraded` |
| `/metrics` | GET | Prometheus metrics (default process metrics + `http_requests_total`) |

`GET /` serves a small static page (`public/index.html`, via `express.static`)
with a form that calls `POST /api/shorten` directly, so the shortener can be
used from a browser without curl or the portfolio dashboard. It is same-origin
with the API, so it needs no CORS handling of its own; the permissive CORS
headers on the other endpoints exist for the portfolio dashboard's
cross-origin requests.

Redis key design:

| Key | Value |
|---|---|
| `url:<code>` | Original long URL |
| `url:<code>:clicks` | Integer click counter (`INCR`) |
| `digest:latest` | JSON `{repo, stars, forks, openIssues, fetchedAt}` |

### 4.2 stats-cron (Node.js 20)

A short-lived script: it calls the GitHub REST API
(`GET /repos/arjitmenon9/cloud-suite`), builds a digest, writes it to
`digest:latest` in Redis, then exits. It runs every 6 hours (`0 */6 * * *`) and
can also be started by hand with `workflow_dispatch` during a demo.

### 4.3 portfolio (static HTML/CSS/JS)

A single static page that calls utility-hub's `/health` and `/api/digest` from
the browser to show live status. It retries up to three times, 4 seconds
apart, to cope with Render free-tier cold starts.

## 5. Technical Designs

### 5.1 Containerisation
- Multi-stage Dockerfile on `node:20-alpine`. Production dependencies are
  installed in a separate stage, which keeps the final image small.
- Runs as a non-root user (`appuser`).
- A Docker `HEALTHCHECK` calls `/health`.
- `docker-compose.yml` starts utility-hub and Redis locally. stats-cron sits
  behind a `manual` profile and runs with `docker compose run --rm stats-cron`.

### 5.2 CI/CD pipeline (`.github/workflows/ci.yml`)
1. Triggered on every push or pull request to `main`.
2. `utility-hub-test` and `stats-cron-test` run in parallel, each against a
   real `redis:7-alpine` service container (the data layer is not mocked).
3. `docker-build` runs only after both test jobs pass. It builds both images
   in a matrix and uses the GitHub Actions layer cache.
4. Render auto-deploys from `main` when a push lands.

### 5.3 Scheduled job (`.github/workflows/stats-cron.yml`)
- Cron schedule `0 */6 * * *`, plus a manual trigger.
- The Redis connection string is kept in GitHub Actions secrets
  (`secrets.REDIS_URL`) and is never committed. The connection uses TLS.

### 5.4 Infrastructure as Code (`terraform/`)
- The `render-oss/render` provider defines `render_redis`, `render_web_service`
  and `render_static_site`.
- The web service's `REDIS_URL` comes from the Redis resource's internal
  connection string, so no credentials are hard-coded.
- The live resources were created first, so they are brought under Terraform
  with `terraform import`. The rule is that `terraform plan` must show no
  changes before any `apply`.

### 5.5 Security and reliability
- Secrets live only in Render environment variables and GitHub secrets.
- All input URLs are validated before they are stored.
- Containers run as a non-root user.
- Health checks run at three levels: Docker, Render and the portfolio page.
- Structured logs (pino) and Prometheus metrics support monitoring.

## 6. Lessons Learned

1. **Pick the tool that fits the budget.** Render's cron jobs are paid, so the
   scheduled job moved to GitHub Actions with no change to the design.
2. **Free tiers have cold starts.** Free Render services sleep when idle, so
   the first health check failed. Retry logic in the portfolio fixed this.
3. **Unauthenticated API limits.** The GitHub API returns 404 for private
   repositories without a token, so the digest tracks this public repo instead.
4. **Test against real dependencies.** Running tests against a real Redis in CI
   caught problems that a mocked data layer would have hidden.
5. **Importing existing resources into IaC.** Resources created by hand have to
   be imported into Terraform before Terraform can manage them safely.
6. **Small, independent services** made it easier to split work across the
   team and to deploy each part separately.

## 7. Individual Contributions

| Team member | Role | Contributions |
|---|---|---|
| **Arjit Menon** | Team lead, backend developer | Overall architecture and service split. Built the utility-hub service (Express app, URL shortener, Redis key design, `/health`). Set up the Render deployment and the managed Redis instance. |
| **Dhruvishi** | Infrastructure as Code | Wrote the Terraform configuration (`render_redis`, `render_web_service`, `render_static_site`, variables, outputs). Documented the import workflow for existing resources. |
| **Arisha** | Scheduled compute developer | Built the stats-cron service (GitHub API client, digest format, Redis writer) and its unit tests with a mocked fetch. Moved the job to the public repo to fix 404 errors. |
| **Manya Vishwanath** | DevOps / CI/CD engineer | Designed the GitHub Actions CI pipeline (parallel test jobs on a real Redis, Docker build matrix with caching) and the scheduled stats-cron workflow with secrets. Wrote the Dockerfiles and docker-compose setup. |
| **Swasti** | Frontend and monitoring, documentation | Built the portfolio status dashboard, including live health and digest checks and the cold-start retry logic. Added Prometheus metrics and structured logging. Prepared the README and this design document. |

## 8. Source Repository

- **Repository:** https://github.com/arjitmenon9/cloud-suite
  - Application code: `utility-hub/`, `stats-cron/`, `portfolio/`
  - IaC scripts: `terraform/`
  - Pipeline configurations: `.github/workflows/ci.yml`, `.github/workflows/stats-cron.yml`
  - Containers: `*/Dockerfile`, `docker-compose.yml`
- **Live URLs:**
  - Portfolio: https://cloud-suite-portfolio.onrender.com
  - Utility Hub: https://cloud-suite-hub.onrender.com
