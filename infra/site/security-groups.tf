# =============================================================================
# Security Groups
# =============================================================================

# --- ALB Security Group ---

resource "aws_security_group" "alb" {
  name_prefix = "${local.prefix}-alb-"
  description = "ShadowSky ALB - allows HTTP/HTTPS from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.prefix}-alb-sg" }

  lifecycle { create_before_destroy = true }
}

# --- ECS Tasks Security Group ---

resource "aws_security_group" "ecs" {
  name_prefix = "${local.prefix}-ecs-"
  description = "ShadowSky ECS tasks - allows traffic from ALB only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP API from ALB"
    from_port       = 3002
    to_port         = 3002
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "WebSocket from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.prefix}-ecs-sg" }

  lifecycle { create_before_destroy = true }
}
