variable "project_name" {
  type        = string
  description = "Project name"
  default     = "blynt"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. dev, staging, prod)"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository formatted as owner/repo"
  default     = "ceylonroameryt-bit/Fi"
}

variable "s3_bucket_arn" {
  type        = string
  description = "ARN of documents S3 bucket"
  default     = ""
}

variable "secrets_arn" {
  type        = string
  description = "ARN of Secrets Manager secret"
  default     = ""
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}

# 1. GitHub Actions OIDC OpenID Connect Provider
# Data source checks if token.actions.githubusercontent.com provider already exists in account
data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  count = 1

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c5878692eee48e569da7e539ee6a2ff83274296"]

  tags = var.tags
}

# 2. GitHub Actions Deployment IAM Role (Least Privilege)
resource "aws_iam_role" "github_deploy" {
  name = "${var.project_name}-${var.environment}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github[0].arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Policy allowing ECR push and App Runner deployment trigger
resource "aws_iam_policy" "github_deploy_policy" {
  name        = "${var.project_name}-${var.environment}-github-deploy-policy"
  description = "Permissions for GitHub Actions to push images and update App Runner"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:*:*:repository/${var.project_name}-${var.environment}-api"
      },
      {
        Sid    = "AppRunnerDeploy"
        Effect = "Allow"
        Action = [
          "apprunner:StartDeployment",
          "apprunner:DescribeService"
        ]
        Resource = "arn:aws:apprunner:*:*:service/${var.project_name}-${var.environment}-api/*"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "github_deploy_attach" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_deploy_policy.arn
}

# 3. App Runner ECR Access Role (Allows App Runner to pull image from private ECR)
resource "aws_iam_role" "app_runner_access" {
  name = "${var.project_name}-${var.environment}-apprunner-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "app_runner_access_attach" {
  role       = aws_iam_role.app_runner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# 4. App Runner Instance Runtime Role (Allows NestJS application to access S3 & Secrets Manager)
resource "aws_iam_role" "app_runner_instance" {
  name = "${var.project_name}-${var.environment}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_policy" "app_runner_runtime_policy" {
  name        = "${var.project_name}-${var.environment}-runtime-policy"
  description = "Allows Blynt API to read secrets and access tenant S3 documents"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerAccess"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secrets_arn != "" ? var.secrets_arn : "*"
      },
      {
        Sid    = "S3DocumentsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arn != "" ? [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ] : ["*"]
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "app_runner_instance_attach" {
  role       = aws_iam_role.app_runner_instance.name
  policy_arn = aws_iam_policy.app_runner_runtime_policy.arn
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "app_runner_access_role_arn" {
  value = aws_iam_role.app_runner_access.arn
}

output "app_runner_instance_role_arn" {
  value = aws_iam_role.app_runner_instance.arn
}
