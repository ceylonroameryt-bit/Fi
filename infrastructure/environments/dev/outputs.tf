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
  value       = module.iam.github_deploy_role_arn
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

output "web_service_url" {
  description = "Public URL of the Blynt Web Frontend on AWS App Runner"
  value       = "https://${aws_apprunner_service.web.service_url}"
}

output "web_service_arn" {
  description = "ARN of the Blynt Web Frontend App Runner service"
  value       = aws_apprunner_service.web.arn
}

output "custom_domain_web_dev_validation" {
  description = "Certificate validation records for dev.blynt.co"
  value       = aws_apprunner_custom_domain_association.web_dev.certificate_validation_records
}

output "custom_domain_web_dev_target" {
  description = "DNS CNAME target for dev.blynt.co"
  value       = aws_apprunner_custom_domain_association.web_dev.dns_target
}

output "custom_domain_web_app_validation" {
  description = "Certificate validation records for app.blynt.co"
  value       = aws_apprunner_custom_domain_association.web_app.certificate_validation_records
}

output "custom_domain_web_app_target" {
  description = "DNS CNAME target for app.blynt.co"
  value       = aws_apprunner_custom_domain_association.web_app.dns_target
}

output "custom_domain_api_validation" {
  description = "Certificate validation records for api.blynt.co"
  value       = aws_apprunner_custom_domain_association.api.certificate_validation_records
}

output "custom_domain_api_target" {
  description = "DNS CNAME target for api.blynt.co"
  value       = aws_apprunner_custom_domain_association.api.dns_target
}


