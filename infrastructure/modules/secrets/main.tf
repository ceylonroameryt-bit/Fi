variable "project_name" {
  type    = string
  default = "blynt"
}

variable "environment" {
  type = string
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type    = number
  default = 5432
}

variable "db_name" {
  type    = string
  default = "blynt"
}

variable "db_user" {
  type    = string
  default = "blynt_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

# High-entropy random secrets generated at provision time
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-${var.environment}-secrets"
  description             = "Application secrets for Blynt ${var.environment} backend API"
  recovery_window_in_days = var.environment == "dev" ? 0 : 7

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL    = "postgresql://${var.db_user}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=require&schema=public"
    DIRECT_URL      = "postgresql://${var.db_user}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}?sslmode=require&schema=public"
    JWT_SECRET      = random_password.jwt_secret.result
    SESSION_SECRET  = random_password.session_secret.result
  })
}

output "secret_arn" {
  value = aws_secretsmanager_secret.app_secrets.arn
}

output "secret_name" {
  value = aws_secretsmanager_secret.app_secrets.name
}
