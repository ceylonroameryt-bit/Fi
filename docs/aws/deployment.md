# Blynt — AWS Deployment Guide

This guide details how to provision and deploy Blynt on AWS in the London region (`eu-west-2`) using Terraform, Amazon ECR, and AWS App Runner.

---

## 1. Prerequisites
1. **AWS CLI v2** configured with administrative credentials in the target AWS account.
2. **Terraform CLI** `>= 1.5.0`.
3. **Docker Engine** (or GitHub Actions runner with Docker support).
4. **Node.js 20+** and **npm 10+**.

---

## 2. Infrastructure Provisioning via Terraform

### Step 2.1: Initialize DEV Environment
Navigate to the Terraform dev environment directory:
```bash
cd infrastructure/environments/dev
```

Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Verify or update variables:
- `aws_region = "eu-west-2"`
- `project_name = "blynt"`
- `environment = "dev"`
- `github_repository = "ceylonroameryt-bit/Fi"`

### Step 2.2: Apply Infrastructure
Run Terraform initialization and apply:
```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### Step 2.3: Record Outputs
Note down the critical outputs produced by Terraform:
- `ecr_repository_url`
- `rds_endpoint`
- `github_oidc_role_arn`
- `secrets_manager_arn`
- `app_runner_service_url`

---

## 3. Initial Container Build & ECR Push

Because AWS App Runner requires an initial container image in ECR before starting the service:

```bash
# 1. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin <ECR_REPOSITORY_URL>

# 2. Build the NestJS API Docker Image from repository root
docker build -t blynt-api:latest -f Dockerfile.api .

# 3. Tag and Push Image to ECR
docker tag blynt-api:latest <ECR_REPOSITORY_URL>:latest
docker push <ECR_REPOSITORY_URL>:latest
```

---

## 4. GitHub Actions CI/CD Setup

To enable automated zero-downtime deployment on push to `main`:

1. Navigate to your GitHub repository: `Settings` → `Secrets and variables` → `Actions`.
2. Add the following repository secret:
   - `AWS_DEPLOY_ROLE_ARN`: The value from Terraform output `github_oidc_role_arn` (e.g., `arn:aws:iam::<ACCOUNT_ID>:role/blynt-dev-github-deploy`).
3. Push code to `main` or trigger the workflow manually under `Actions` → `Deploy to AWS DEV` → `Run workflow`.

The GitHub Actions workflow automatically:
1. Runs linting, typechecks, and the comprehensive 87-test suite.
2. Assumes the IAM OIDC role securely (no stored keys).
3. Builds and pushes the new container image to ECR.
4. Triggers the AWS App Runner deployment operation.
5. Verifies container health against `/api/v1/health`.
