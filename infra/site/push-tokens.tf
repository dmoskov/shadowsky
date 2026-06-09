# Durable storage for push notification tokens.
#
# The API server (server/routes/push-notifications.js) uses this table when
# the PUSH_TOKENS_TABLE env var is set (wired in ecs.tf); without it the
# server falls back to an in-memory store that loses tokens on every ECS
# restart and is not shared across tasks.

resource "aws_dynamodb_table" "push_tokens" {
  name         = "${local.prefix}-push-tokens"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "did"

  attribute {
    name = "did"
    type = "S"
  }
}

resource "aws_iam_role_policy" "ecs_task_push_tokens" {
  name = "${local.prefix}-push-tokens"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan"
      ]
      Resource = aws_dynamodb_table.push_tokens.arn
    }]
  })
}
