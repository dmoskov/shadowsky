# =============================================================================
# IAM Roles
# =============================================================================

# --- ECS Task Execution Role (pulls images, reads secrets, writes logs) ---

resource "aws_iam_role" "ecs_execution" {
  name = "${local.prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_base" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.prefix}-secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.anthropic_api_key.arn]
    }]
  })
}

# --- ECS Task Role (what the running container can do) ---

resource "aws_iam_role" "ecs_task" {
  name = "${local.prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# Allow STS operations for Anthropic Workload Identity Federation
resource "aws_iam_role_policy" "ecs_task_sts" {
  name = "${local.prefix}-sts-federation"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sts:GetCallerIdentity",
        "sts:GetWebIdentityToken",
        "sts:TagGetWebIdentityToken"
      ]
      Resource = "*"
    }]
  })
}

# Allow ECS Exec (interactive debugging)
resource "aws_iam_role_policy" "ecs_task_exec" {
  name = "${local.prefix}-ecs-exec"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

# --- GitHub Actions deploy role policies ---
#
# The "github-actions-deploy-role" itself is created outside this Terraform
# (assumed via OIDC in .github/workflows/deploy-server.yml), but its inline
# policies are managed here so the deploy permissions live in IaC.

# PassRole for the ECS execution/task roles. Registering an ECS task definition
# requires iam:PassRole on the roles it references; without it the "Deploy API
# Server" job fails with AccessDeniedException on RegisterTaskDefinition. Scoped
# so the roles can only be passed to ECS tasks.
resource "aws_iam_role_policy" "github_actions_pass_ecs_roles" {
  name = "${local.prefix}-pass-ecs-roles"
  role = "github-actions-deploy-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "iam:PassRole"
      Resource = [
        aws_iam_role.ecs_execution.arn,
        aws_iam_role.ecs_task.arn
      ]
      Condition = {
        StringEquals = {
          "iam:PassedToService" = "ecs-tasks.amazonaws.com"
        }
      }
    }]
  })
}

# Core deploy permissions (ECR push, ECS register/update, networking, logs).
# Imported from the previously hand-managed "shadowsky-deploy" inline policy.
# Note vs. the original hand-written version: the CloudWatch Logs ARN now uses
# the deploy region (was hard-coded to us-west-1 while the service runs in
# us-east-1), and the stale PassRole statement (which referenced non-existent
# ecsTaskRole/ecsTaskExecutionRole names) is dropped in favor of the scoped
# github_actions_pass_ecs_roles policy above.
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${local.prefix}-deploy"
  role = "github-actions-deploy-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECR"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECS"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:CreateCluster",
          "ecs:ListTasks",
          "ecs:DescribeTasks"
        ]
        Resource = "*"
      },
      {
        Sid    = "Networking"
        Effect = "Allow"
        Action = [
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:CreateSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress"
        ]
        Resource = "*"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/shadowsky-api-server:*"
      }
    ]
  })
}
