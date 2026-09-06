# Retired 2026-09-06. Retain data until explicit retention decisions.

resource "aws_dynamodb_table" "push_tokens" {
  name         = "${local.prefix}-push-tokens"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "did"

  attribute {
    name = "did"
    type = "S"
  }
  lifecycle { prevent_destroy = true }
}

resource "aws_ecr_repository" "api_server" {
  name                 = "${local.prefix}-api-server"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
  lifecycle { prevent_destroy = true }
}

resource "aws_cloudwatch_log_group" "api_server" {
  name              = "/ecs/${local.prefix}-api-server"
  retention_in_days = 0
  lifecycle { prevent_destroy = true }
}

resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name                    = "${local.prefix}/anthropic-api-key"
  description             = "Anthropic API key for ShadowSky AI features"
  recovery_window_in_days = 7
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket" "build_artifacts" {
  bucket = "${local.prefix}-build-artifacts-${data.aws_caller_identity.current.account_id}"
  lifecycle { prevent_destroy = true }
}

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/codebuild/${local.prefix}-api-server"
  retention_in_days = 0
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${local.prefix}-frontend-${data.aws_caller_identity.current.account_id}"
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
  lifecycle { prevent_destroy = true }
}
