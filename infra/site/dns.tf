# =============================================================================
# Route53 DNS Records
# =============================================================================

# --- shadowsky.io API ---

resource "aws_route53_record" "api_shadowsky" {
  zone_id = data.aws_route53_zone.shadowsky.zone_id
  name    = "api.shadowsky.io"
  type    = "A"

  alias {
    name                   = data.aws_lb.pan.dns_name
    zone_id                = data.aws_lb.pan.zone_id
    evaluate_target_health = true
  }
}

# --- asphodel.is API ---

resource "aws_route53_record" "api_asphodel" {
  zone_id = data.aws_route53_zone.asphodel.zone_id
  name    = "api.asphodel.is"
  type    = "A"

  alias {
    name                   = data.aws_lb.pan.dns_name
    zone_id                = data.aws_lb.pan.zone_id
    evaluate_target_health = true
  }
}

# --- asphodel.is web ---
# NOT managed by Terraform. The asphodel.is, www.asphodel.is, and
# main.asphodel.is records point at AWS Amplify (app d1g6mni4b6812x), whose
# domain association owns their lifecycle (its CloudFront target can change
# when Amplify re-provisions). The records previously defined here were
# removed from state via `terraform state rm` on 2026-06-09, and the old
# S3-backed asphodel CloudFront distribution was destroyed — do not re-add
# either here.

# --- shadowsky.io web (CloudFront) ---
# These are created only after removing aliases from the old Amplify CloudFront distribution

resource "aws_route53_record" "shadowsky_apex" {
  count   = length(var.cloudfront_aliases_shadowsky) > 0 ? 1 : 0
  zone_id = data.aws_route53_zone.shadowsky.zone_id
  name    = "shadowsky.io"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.shadowsky.domain_name
    zone_id                = aws_cloudfront_distribution.shadowsky.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "shadowsky_www" {
  count   = contains(var.cloudfront_aliases_shadowsky, "www.shadowsky.io") ? 1 : 0
  zone_id = data.aws_route53_zone.shadowsky.zone_id
  name    = "www.shadowsky.io"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.shadowsky.domain_name]
}
