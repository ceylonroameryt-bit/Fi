# Blynt — AWS Cost Controls & DEV Budgeting

## 1. Budget Objective
The target monthly cloud spend for the Blynt Development (DEV) environment on AWS is **under $35–45 / month**.

---

## 2. DEV Cost Allocation Breakdown

| Service | DEV Tier / Configuration | Estimated Monthly Cost |
|---|---|---|
| **AWS App Runner** | 1 vCPU, 2 GB RAM (Scaled to 0-1 instance during idle) | ~$10 - $18 / mo |
| **Amazon RDS PostgreSQL** | `db.t4g.micro`, Single-AZ, 20 GB gp3 | ~$12 - $15 / mo |
| **Amazon ECR** | Container repository (lifecycle rule: max 10 images) | ~$0.50 / mo |
| **Amazon S3** | Standard storage (DEV documents, < 5 GB) | ~$0.20 / mo |
| **AWS Secrets Manager** | 1 secret (`blynt-dev-secrets`) | ~$0.40 / mo |
| **CloudWatch Logs** | 7-day retention period, < 1 GB log ingestion | ~$0.50 / mo |
| **NAT Gateways** | **EXCLUDED** (No NAT Gateway created in DEV) | **$0.00 / mo** (saves ~$32/mo!) |
| **Total Estimated DEV Spend** | | **~$25 - $35 / mo** |

---

## 3. Strict Architectural Rules for DEV
1. **No NAT Gateways**: App Runner uses VPC Egress Connector directly into private subnets for RDS connectivity; outbound internet calls do not require a NAT Gateway.
2. **Single-AZ for RDS DEV**: Multi-AZ RDS doubles database costs unnecessarily in DEV. Use Single-AZ in `eu-west-2a` with automated snapshots for DEV.
3. **ECR Lifecycle Policy**: Automatically delete untagged or older images beyond the most recent 10 images to prevent storage accumulation.
4. **CloudWatch Retention Limits**: All log groups in DEV must have an explicit 7-day retention limit (`retention_in_days = 7`).
5. **No Aurora / Provisioned Redis in DEV**: Standard PostgreSQL 16.6 on `db.t4g.micro` handles development and testing workloads with high fidelity and predictable costs.

---

## 4. AWS Budgets & Alerting
A budget alarm should be configured at **$50.00 / month**:
- Threshold 1: 80% ($40.00 actual spend) → Email alert to engineering leads.
- Threshold 2: 100% ($50.00 forecasted spend) → Urgent Slack / email notification.
