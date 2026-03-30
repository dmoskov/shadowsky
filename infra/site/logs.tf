# =============================================================================
# CloudWatch Log Groups
# =============================================================================

resource "aws_cloudwatch_log_group" "api_server" {
  name              = "/ecs/${local.prefix}-api-server"
  retention_in_days = 30
}
