# =============================================================================
# ECS - Fargate Cluster, Task Definition, Service
# =============================================================================

resource "aws_ecs_cluster" "main" {
  name = "${local.prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# --- Task Definition ---

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.prefix}-api-server"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "api-server"
    image     = "${aws_ecr_repository.api_server.repository_url}:${var.api_image_tag}"
    essential = true

    portMappings = [
      { containerPort = 3002, protocol = "tcp", name = "http" },
      { containerPort = 3001, protocol = "tcp", name = "websocket" }
    ]

    environment = [
      { name = "PORT", value = "3002" },
      { name = "WS_PORT", value = "3001" },
      { name = "NODE_ENV", value = "production" },
      { name = "TRENDING_TABLE_NAME", value = "${local.prefix}-trending-${var.environment}" },
      { name = "FIREHOSE_SAMPLE_RATE", value = "1" },
      { name = "PUSH_TOKENS_TABLE", value = aws_dynamodb_table.push_tokens.name }
    ]

    secrets = [
      {
        name      = "ANTHROPIC_API_KEY"
        valueFrom = aws_secretsmanager_secret.anthropic_api_key.arn
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api_server.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3002/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# --- Service ---

resource "aws_ecs_service" "api" {
  name            = "${local.prefix}-api-server"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api_http.arn
    container_name   = "api-server"
    container_port   = 3002
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api_ws.arn
    container_name   = "api-server"
    container_port   = 3001
  }

  health_check_grace_period_seconds = 120

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}
