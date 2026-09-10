output "hub_url" {
  value = render_web_service.hub.url
}

output "portfolio_url" {
  value = render_static_site.portfolio.url
}

output "kv_id" {
  value = render_redis.kv.id
}
