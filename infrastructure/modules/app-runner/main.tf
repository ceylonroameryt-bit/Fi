variable "project_name" {
  type    = string
  default = "blynt"
}

variable "environment" {
  type = string
}

variable "image_repository_url" {
  type        = string
  description = "ECR repository URL"
}

variable "image_tag" {
  type        = string
  description = "Image tag to deploy (default latest / git sha)"
  default     = "latest"
}

variable "access_role_arn" {
  type        = string
  description = "IAM role ARN allowing App Runner to pull from ECR"
}

variable "instance_role_arn" {
  type        = string
  description = "IAM role ARN for runtime task execution (S3, Secrets Manager)"
}

variable "vpc_subnet_ids" {
  type        = list(string)
  description = "Private subnets for App Runner VPC egress to RDS"
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "Security group for App Runner VPC connector"
}

variable "secrets_arn" {
  type        = string
  description = "ARN of Secrets Manager secret"
}

variable "frontend_url" {
  type    = string
  default = "http://localhost:3000"
}

variable "tags" {
  type    = map(string)
  default = {}
}

# 1. VPC Connector (Enables private egress from App Runner to RDS in private subnets)
resource "aws_apprunner_vpc_connector" "connector" {
  vpc_connector_name = "${var.project_name}-${var.environment}-vpc-conn"
  subnets            = var.vpc_subnet_ids
  security_groups    = var.vpc_security_group_ids

  tags = var.tags
}

# 2. App Runner Service
resource "aws_apprunner_service" "api" {
  service_name = "${var.project_name}-${var.environment}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = var.access_role_arn
    }

    image_repository {
      image_identifier      = "${var.image_repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "4000"

        runtime_environment_variables = {
          NODE_ENV             = "production"
          APP_ENV              = var.environment
          PORT                 = "4000"
          FRONTEND_URL         = var.frontend_url
          CORS_ALLOWED_ORIGINS = var.frontend_url
          MAIL_PROVIDER        = "console"
          LOG_LEVEL            = "info"
        }

        runtime_environment_secrets = {
          DATABASE_URL   = "${var.secrets_arn}:DATABASE_URL::"
          DIRECT_URL     = "${var.secrets_arn}:DIRECT_URL::"
          JWT_SECRET     = "${var.secrets_arn}:JWT_SECRET::"
          SESSION_SECRET = "${var.secrets_arn}:SESSION_SECRET::"
        }
      }
    }

    auto_deployments_enabled = false # Controlled deployments via GitHub Actions OIDC
  }

  instance_configuration {
    cpu               = "1024" # 1 vCPU
    memory            = "2048" # 2 GB RAM (Comfortable for NestJS & Prisma engine)
    instance_role_arn = var.instance_role_arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.connector.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/v1/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = var.tags
}

output "service_url" {
  value = "https://${aws_apprunner_service.api.service_url}"
}

output "service_arn" {
  value = aws_apprunner_service.api.arn
}

output "service_id" {
  value = aws_apprunner_service.api.service_id
}
