variable "allow_retired_site_deployment" {
  type        = bool
  default     = false
  description = "Explicit override required before planning infrastructure for retired Asphodel."

  validation {
    condition     = var.allow_retired_site_deployment
    error_message = "Asphodel public hosting was retired 2026-09-06. Normal Terraform plans/applies are blocked to prevent recreation of legacy web infrastructure. Reopening requires an explicit user decision; preserve PAN feed hosts."
  }
}
