terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "shadowsky"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  prefix = "shadowsky"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# Existing Route53 hosted zones (use zone_id only to avoid duplicate zone matching)
data "aws_route53_zone" "shadowsky" {
  zone_id = "Z1002571THA70GW1RBGB"
}

data "aws_route53_zone" "asphodel" {
  zone_id = "Z0676411215OEF4OS4O0X"
}

# Existing ACM certificate covering both domains
# SANs: shadowsky.io, *.shadowsky.io, asphodel.is, *.asphodel.is
data "aws_acm_certificate" "combined" {
  domain      = "shadowsky.io"
  statuses    = ["ISSUED"]
  most_recent = true

  # This cert has SANs for both domains
  # ARN: arn:aws:acm:us-east-1:181691141781:certificate/0a173bfe-3774-4a34-af22-5e0e76e1148b
}

data "aws_acm_certificate" "asphodel" {
  domain      = "asphodel.is"
  statuses    = ["ISSUED"]
  most_recent = true
}
