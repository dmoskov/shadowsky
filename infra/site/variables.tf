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
  description = "CloudFront aliases for asphodel.is on the S3 distribution"
  type        = list(string)
  default     = []
  # Empty since 2026-06-02: asphodel.is, www.asphodel.is, and main.asphodel.is
  # are served by AWS Amplify (app d1g6mni4b6812x), which owns their aliases
  # and Route53 records. Claiming these aliases here would conflict with
  # Amplify's distribution and take the site down. The S3 distribution
  # (aws_cloudfront_distribution.asphodel) is kept but dormant.
}
