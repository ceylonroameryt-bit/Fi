terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local state default for bootstrap. Can be migrated to S3 backend when remote bucket is created.
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Blynt"
      Environment = "dev"
      ManagedBy   = "Terraform"
      Region      = var.aws_region
    }
  }
}

# 1. Cost-controlled VPC for DEV (Single-region, 2 AZs, no expensive NAT Gateways)
resource "aws_vpc" "dev" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "blynt-dev-vpc"
  }
}

# Two private subnets for RDS & App Runner egress
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.dev.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "blynt-dev-private-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.dev.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "blynt-dev-private-b"
  }
}

# Security group for App Runner VPC egress connector
resource "aws_security_group" "apprunner_connector" {
  name        = "blynt-dev-apprunner-connector-sg"
  description = "Security group for App Runner VPC egress connector"
  vpc_id      = aws_vpc.dev.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "blynt-dev-apprunner-connector-sg"
  }
}

# 2. S3 Documents Storage
module "s3" {
  source       = "../../modules/s3"
  project_name = var.project_name
  environment  = "dev"
}

# 3. ECR Repository
module "ecr" {
  source       = "../../modules/ecr"
  project_name = var.project_name
  environment  = "dev"
}

# 4. RDS PostgreSQL (Single-AZ, db.t4g.micro)
module "rds" {
  source                = "../../modules/rds"
  project_name          = var.project_name
  environment           = "dev"
  vpc_id                = aws_vpc.dev.id
  subnet_ids            = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  app_security_group_id = aws_security_group.apprunner_connector.id
  database_name         = "blynt"
  db_instance_class     = "db.t4g.micro"
}

# 5. Secrets Manager
module "secrets" {
  source       = "../../modules/secrets"
  project_name = var.project_name
  environment  = "dev"
  db_host      = module.rds.address
  db_port      = module.rds.port
  db_name      = module.rds.database_name
  db_user      = module.rds.master_username
  db_password  = module.rds.master_password
}

# 6. IAM & GitHub Actions OIDC
module "iam" {
  source            = "../../modules/iam"
  project_name      = var.project_name
  environment       = "dev"
  github_repository = var.github_repository
  s3_bucket_arn     = module.s3.bucket_arn
  secrets_arn       = module.secrets.secret_arn
}

# 7. CloudWatch Logs
module "monitoring" {
  source            = "../../modules/monitoring"
  project_name      = var.project_name
  environment       = "dev"
  retention_in_days = 7
}

# 8. App Runner Service
module "app_runner" {
  source                 = "../../modules/app-runner"
  project_name           = var.project_name
  environment            = "dev"
  image_repository_url   = module.ecr.repository_url
  image_tag              = var.image_tag
  access_role_arn        = module.iam.app_runner_access_role_arn
  instance_role_arn      = module.iam.app_runner_instance_role_arn
  vpc_subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  vpc_security_group_ids = [aws_security_group.apprunner_connector.id]
  secrets_arn            = module.secrets.secret_arn
  frontend_url           = var.frontend_url
}
