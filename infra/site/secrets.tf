# =============================================================================
# Secrets Manager
# =============================================================================

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${local.prefix}/anthropic-api-key"
  description             = "Anthropic API key for ShadowSky AI features"
  recovery_window_in_days = 7
}

# Populate manually after apply:
# aws secretsmanager put-secret-value \
#   --secret-id shadowsky/anthropic-api-key \
#   --secret-string "sk-ant-..." \
#   --region us-east-1
