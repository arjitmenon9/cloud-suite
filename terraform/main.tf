provider "render" {
  api_key  = var.render_api_key
  owner_id = var.render_owner_id
}

resource "render_redis" "kv" {
  name              = "cloud-suite-kv"
  region            = "oregon"
  plan              = "free"
  max_memory_policy = "noeviction"
  persistence_mode  = "off"
}

resource "render_web_service" "hub" {
  name   = "cloud-suite-hub"
  plan   = "free"
  region = "oregon"

  start_command     = "npm start"
  health_check_path = "/health"

  runtime_source = {
    native_runtime = {
      auto_deploy    = true
      branch         = var.branch
      build_command  = "npm install"
      repo_url       = var.github_repo_url
      runtime        = "node"
    }
  }

  root_directory = "utility-hub"

  # NOTE: same caveat as todo-app/terraform/main.tf — verify the exact
  # connection_info attribute path (likely `internal_connection_string`,
  # per the provider's render_redis docs, but not confirmed against a live
  # `terraform providers schema` at time of writing) before relying on it.
  env_vars = {
    "REDIS_URL" = { value = render_redis.kv.connection_info.internal_connection_string }
    "REDIS_TLS" = { value = "true" }
  }
}

resource "render_static_site" "portfolio" {
  name          = "cloud-suite-portfolio"
  repo_url      = var.github_repo_url
  branch        = var.branch
  build_command = "echo 'static site, no build needed'"
  publish_path  = "."
  root_directory = "portfolio"
}

# No render_cron_job here on purpose: Render Cron Jobs require a paid plan.
# The scheduled digest job runs as a free GitHub Actions scheduled workflow
# instead (.github/workflows/stats-cron.yml) — see terraform/README.md.
