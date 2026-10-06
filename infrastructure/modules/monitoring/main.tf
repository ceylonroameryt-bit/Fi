variable "project_name" {
  type    = string
  default = "blynt"
}

variable "environment" {
  type = string
}

variable "retention_in_days" {
  type        = number
  description = "CloudWatch log retention in days (7 for DEV, 30 for Prod)"
  default     = 7
}

variable "tags" {
  type    = map(string)
  default = {}
}

# 1. CloudWatch Log Group for App Runner Service Logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/apprunner/${var.project_name}-${var.environment}-api"
  retention_in_days = var.retention_in_days

  tags = var.tags
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.app_logs.name
}

output "log_group_arn" {
  value = aws_cloudwatch_log_group.app_logs.arn
}
