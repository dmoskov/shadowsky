variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.3.0.0/16"
}

variable "api_image_tag" {
  description = "Docker image tag for API server"
  type        = string
  default     = "latest"
}

variable "api_cpu" {
  description = "API task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "API task memory in MB"
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Number of API server tasks to run"
  type        = number
  default     = 1
}

variable "cloudfront_aliases_shadowsky" {
  description = "CloudFront aliases for shadowsky.io"
  type        = list(string)
  default     = ["shadowsky.io", "www.shadowsky.io"]
}

# --- Anthropic Workload Identity Federation ---
# Populated once the Console federation rule is created (HUMAN STEP).
# Until then, leave empty — ANTHROPIC_API_KEY takes precedence.

variable "anthropic_federation_rule_id" {
  description = "Anthropic federation rule ID for keyless auth"
  type        = string
  default     = ""
}

variable "anthropic_organization_id" {
  description = "Anthropic organization ID for keyless auth"
  type        = string
  default     = ""
}

variable "anthropic_service_account_id" {
  description = "Anthropic service account ID for keyless auth"
  type        = string
  default     = ""
}

variable "anthropic_workspace_id" {
  description = "Anthropic workspace ID for keyless auth"
  type        = string
  default     = ""
}

variable "api_service_did" {
  description = "DID the API server verifies as the audience of client service-auth tokens. Must match API_SERVICE_DID in packages/core/src/api-auth.ts."
  type        = string
  default     = "did:web:api.asphodel.is"
}

variable "allow_unsigned_did_auth" {
  description = "Rollout flag: accept the legacy unverified X-User-DID header. Set false once all clients send service-auth tokens."
  type        = bool
  default     = true
}

variable "ai_user_daily_token_budget" {
  description = "Max Anthropic tokens (input + output) a single account may consume per UTC day"
  type        = number
  default     = 500000
}

variable "ai_global_daily_token_budget" {
  description = "Max Anthropic tokens the whole service may consume per UTC day (circuit breaker)"
  type        = number
  default     = 25000000
}

variable "ai_max_request_tokens" {
  description = "Max estimated tokens (prompt + max_tokens) for a single AI request"
  type        = number
  default     = 120000
}

# NOTE: asphodel.is web hosting is NOT managed here. asphodel.is,
# www.asphodel.is, and main.asphodel.is are served by AWS Amplify
# (app d1g6mni4b6812x), which owns their CloudFront aliases and Route53
# records. The former S3-backed asphodel distribution (EMRRAFHTOF28N) was
# destroyed on 2026-06-09. Do not re-create CloudFront aliases or DNS
# records for those hostnames here — they would conflict with Amplify's
# distribution and take the site down.
