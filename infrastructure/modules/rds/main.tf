variable "project_name" {
  type    = string
  default = "blynt"
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "app_security_group_id" {
  type    = string
  default = ""
}

variable "database_name" {
  type    = string
  default = "blynt"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "backup_retention_period" {
  type    = number
  default = 7
}

variable "tags" {
  type    = map(string)
  default = {}
}

# Master password randomly generated and stored in Secrets Manager
resource "random_password" "db_password" {
  length           = 32
  special          = false # Alphanumeric to avoid URI encoding complications
}

# DB Subnet Group (Private subnets)
resource "aws_db_subnet_group" "db" {
  name       = "${var.project_name}-${var.environment}-db-subnets"
  subnet_ids = var.subnet_ids

  tags = var.tags
}

# Security group: PostgreSQL accessible only from App Runner VPC Connector
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Allows inbound traffic to PostgreSQL from Blynt API App Runner"
  vpc_id      = var.vpc_id

  tags = var.tags
}

resource "aws_security_group_rule" "rds_ingress_app" {
  count                    = var.app_security_group_id != "" ? 1 : 0
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = var.app_security_group_id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from App Runner security group"
}

# Fallback VPC-internal ingress rule if security group id is not explicitly specified
resource "aws_security_group_rule" "rds_ingress_self" {
  count             = var.app_security_group_id == "" ? 1 : 0
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  self              = true
  security_group_id = aws_security_group.rds.id
  description       = "PostgreSQL internal"
}

resource "aws_security_group_rule" "rds_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.rds.id
}

# RDS Parameter Group (PostgreSQL 16)
resource "aws_db_parameter_group" "pg16" {
  name   = "${var.project_name}-${var.environment}-pg16-params"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = var.tags
}

# Single-AZ Low Cost DEV RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier                  = "${var.project_name}-${var.environment}-db"
  engine                      = "postgres"
  engine_version              = "16.6"
  instance_class              = var.db_instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = 50 # Auto-minor scaling up to 50GB
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = var.database_name
  username                    = "blynt_admin"
  password                    = random_password.db_password.result
  port                        = 5432
  publicly_accessible         = false
  multi_az                    = false # Keep False in DEV for cost control
  db_subnet_group_name        = aws_db_subnet_group.db.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  parameter_group_name        = aws_db_parameter_group.pg16.name
  backup_retention_period     = var.backup_retention_period
  backup_window               = "03:00-04:00"
  maintenance_window          = "Sun:04:30-Sun:05:30"
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  skip_final_snapshot         = var.environment == "dev" ? true : false
  final_snapshot_identifier   = var.environment == "dev" ? null : "${var.project_name}-${var.environment}-final-snapshot"
  deletion_protection         = var.environment == "dev" ? false : true

  tags = var.tags
}

output "endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "address" {
  value = aws_db_instance.postgres.address
}

output "port" {
  value = aws_db_instance.postgres.port
}

output "database_name" {
  value = aws_db_instance.postgres.db_name
}

output "master_username" {
  value = aws_db_instance.postgres.username
}

output "master_password" {
  value     = random_password.db_password.result
  sensitive = true
}

output "security_group_id" {
  value = aws_security_group.rds.id
}
