variable "render_api_key" {
  description = "Render API key. Pass via TF_VAR_render_api_key — never commit it."
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render workspace/owner ID."
  type        = string
  default     = "tea-dah7gbajnfac738l08ug"
}

variable "github_repo_url" {
  description = "Monorepo Render deploys from."
  type        = string
  default     = "https://github.com/arjitmenon9/cloud-suite"
}

variable "branch" {
  description = "Branch to deploy."
  type        = string
  default     = "main"
}
