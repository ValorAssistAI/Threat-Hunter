output "ecr_repository_url" {
  description = "ECR repository URL for the API server image"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}

output "api_alb_dns" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.api.dns_name
}

output "s3_artifacts_bucket" {
  description = "S3 bucket for arnievulnai artifacts"
  value       = aws_s3_bucket.artifacts.bucket
}

output "cloudwatch_log_groups" {
  description = "CloudWatch log group names"
  value = {
    audit          = aws_cloudwatch_log_group.audit.name
    scan_results   = aws_cloudwatch_log_group.scan_results.name
    threat_intel   = aws_cloudwatch_log_group.threat_intel.name
    tool_invocations = aws_cloudwatch_log_group.tool_invocations.name
    api            = aws_cloudwatch_log_group.api.name
  }
}

output "secrets_manager_arns" {
  description = "Secrets Manager ARNs"
  value = {
    virustotal = aws_secretsmanager_secret.virustotal.arn
  }
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "guardduty_detector_id" {
  description = "GuardDuty detector ID"
  value       = aws_guardduty_detector.main.id
}
