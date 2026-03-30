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

variable "cloudfront_aliases_asphodel" {
  description = "CloudFront aliases for asphodel.is"
  type        = list(string)
  default     = ["asphodel.is", "www.asphodel.is"]
  # asphodel.is has no existing CloudFront distribution, safe to claim immediately
}
