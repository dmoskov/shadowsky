# =============================================================================
# Route53 DNS Records
# =============================================================================

# --- shadowsky.io API ---

resource "aws_route53_record" "api_shadowsky" {
  zone_id = data.aws_route53_zone.shadowsky.zone_id
  name    = "api.shadowsky.io"
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

# --- asphodel.is API ---

resource "aws_route53_record" "api_asphodel" {
  zone_id = data.aws_route53_zone.asphodel.zone_id
  name    = "api.asphodel.is"
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

# --- asphodel.is web (CloudFront) ---

resource "aws_route53_record" "asphodel_apex" {
  count   = length(var.cloudfront_aliases_asphodel) > 0 ? 1 : 0
  zone_id = data.aws_route53_zone.asphodel.zone_id
  name    = "asphodel.is"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.asphodel.domain_name
    zone_id                = aws_cloudfront_distribution.asphodel.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "asphodel_www" {
  count   = contains(var.cloudfront_aliases_asphodel, "www.asphodel.is") ? 1 : 0
  zone_id = data.aws_route53_zone.asphodel.zone_id
  name    = "www.asphodel.is"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.asphodel.domain_name]
}

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
