variable "aws_region" {
  description = "Primary AWS region for Blynt deployment"
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Project name prefix used for all AWS resources"
  type        = string
  default     = "blynt"
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "dev"
}

variable "github_repository" {
  description = "GitHub repository formatted as owner/repo for OIDC trust policy"
  type        = string
  default     = "ceylonroameryt-bit/Fi"
}

variable "image_tag" {
  description = "Container image tag to deploy to AWS App Runner"
  type        = string
  default     = "latest"
}

variable "frontend_url" {
  description = "Frontend origin URL for CORS configuration"
  type        = string
  default     = "http://localhost:3000"
}
