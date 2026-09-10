# Terraform (cloud-suite)

Describes `cloud-suite-kv` (Redis), `cloud-suite-hub` (web service), and
`cloud-suite-portfolio` (static site) as code. Like `todo-app`'s Terraform,
this is **written but not applied** — the live resources were created
directly via Render's API/dashboard. See the sibling `todo-app/terraform/README.md`
for the general import-vs-fresh-environment approach; the same applies here:

```bash
terraform init
terraform import render_redis.kv red-dah85re1egvs73d0o720
terraform import render_web_service.hub srv-dah865e1egvs73d0pjm0
terraform import render_static_site.portfolio srv-dah86pajnfac738noj00
terraform plan   # must show no changes before ever applying
```

Deliberately no `render_cron_job` resource: Render's Cron Jobs require a
paid plan, so the scheduled digest fetch runs as a free GitHub Actions
scheduled workflow instead (see `../.github/workflows/stats-cron.yml`) —
a good example of choosing the tool that fits the budget, not just the
first one that comes to mind.
