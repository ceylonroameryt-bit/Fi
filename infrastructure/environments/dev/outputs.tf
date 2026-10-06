output "ecr_repository_url" {
  description = "URL of the Amazon ECR repository for the NestJS API"
  value       = module.ecr.repository_url
}

output "rds_endpoint" {
  description = "Address endpoint of the RDS PostgreSQL instance"
  value       = module.rds.address
}

output "rds_port" {
  description = "Port of the RDS PostgreSQL instance"
  value       = module.rds.port
}

output "rds_database_name" {
  description = "PostgreSQL database name"
  value       = module.rds.database_name
}

output "s3_bucket_name" {
  description = "Name of the S3 documents storage bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 documents storage bucket"
  value       = module.s3.bucket_arn
}

output "github_oidc_role_arn" {
  description = "IAM Role ARN to assume via GitHub Actions OIDC"
  value       = module.iam.github_actions_role_arn
}

output "secrets_manager_arn" {
  description = "ARN of the AWS Secrets Manager secret"
  value       = module.secrets.secret_arn
}

output "app_runner_service_url" {
  description = "Default public URL of the Blynt API App Runner service"
  value       = module.app_runner.service_url
}

output "app_runner_service_arn" {
  description = "ARN of the Blynt API App Runner service"
  value       = module.app_runner.service_arn
}

output "cloudwatch_log_group" {
  description = "Name of the CloudWatch log group for Blynt API logs"
  value       = module.monitoring.log_group_name
}
