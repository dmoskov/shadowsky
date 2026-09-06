output "vpc_id" {
  description = "Shared Pan VPC ID used by the ShadowSky service"
  value       = data.aws_vpc.pan.id
}

output "ecr_repository_url" {
  description = "ECR repository URL for API server"
  value       = aws_ecr_repository.api_server.repository_url
}

output "alb_dns_name" {
  description = "ALB DNS name for API server"
  value       = data.aws_lb.pan.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (for Route53 alias records)"
  value       = data.aws_lb.pan.zone_id
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}

output "cloudfront_distribution_id_shadowsky" {
  description = "CloudFront distribution ID for shadowsky.io"
  value       = aws_cloudfront_distribution.shadowsky.id
}

output "cloudfront_domain_shadowsky" {
  description = "CloudFront domain name for shadowsky.io"
  value       = aws_cloudfront_distribution.shadowsky.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket for web frontend static files"
  value       = aws_s3_bucket.frontend.id
}

output "secrets_arn" {
  description = "Secrets Manager ARN for Anthropic API key"
  value       = aws_secretsmanager_secret.anthropic_api_key.arn
}

# Deployment instructions
output "next_steps" {
  description = "Post-apply steps"
  value       = <<-EOT
    1. Populate secret:
       aws secretsmanager put-secret-value \
         --secret-id ${aws_secretsmanager_secret.anthropic_api_key.name} \
         --secret-string "sk-ant-..." \
         --region ${var.aws_region}

    2. Build and push Docker image:
       cd docker && ./build-push.sh

    3. Upload frontend:
       cd /path/to/bsky && npm run build
       aws s3 sync dist/ s3://${aws_s3_bucket.frontend.id}/ --delete

    4. Invalidate CloudFront:
       aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.shadowsky.id} --paths "/*"
  EOT
}
