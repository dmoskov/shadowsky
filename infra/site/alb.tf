# =============================================================================
# Shared Pan network and load balancer integration
# =============================================================================
#
# The public API ALB, its target groups, and the network security boundary are
# owned by ../../pan/infra/site. ShadowSky owns its ECS task and service, and
# attaches that service to the shared resources through these data sources.

data "aws_vpc" "pan" {
  filter {
    name   = "tag:Name"
    values = ["pan-vpc"]
  }
}

data "aws_subnets" "pan_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.pan.id]
  }

  filter {
    name   = "tag:Name"
    values = ["pan-private-*"]
  }
}

data "aws_security_group" "pan_shadowsky_api" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.pan.id]
  }

  filter {
    name   = "tag:Name"
    values = ["pan-shadowsky-api-sg"]
  }
}

data "aws_lb" "pan" {
  name = "pan-alb"
}

data "aws_lb_target_group" "pan_shadowsky_api_http" {
  name = "pan-shadowsky-http-tg"
}

data "aws_lb_target_group" "pan_shadowsky_api_ws" {
  name = "pan-shadowsky-ws-tg"
}
