import os
import re
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
OUTPUT_MD = os.path.join(DOCS_DIR, "BLYNT_SECURITY_SOC2_PENTEST_GRC.md")
OUTPUT_DOCX = os.path.join(DOCS_DIR, "blynt_Security_SOC2_Pentest_GRC.docx")
OUTPUT_PDF = os.path.join(DOCS_DIR, "blynt_Security_SOC2_Pentest_GRC.pdf")
LOGO_PATH = os.path.join(WORKSPACE_DIR, "blynt-logo.png")

NAVY = RGBColor(22, 45, 95)       # #162D5F
CORAL = RGBColor(255, 127, 108)   # #FF7F6C
SLATE = RGBColor(71, 85, 105)     # #475569
CHARCOAL = RGBColor(30, 41, 59)   # #1E293B

def set_cell_background(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=70, bottom=70, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_cover_page(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after = Pt(10)

    if os.path.exists(LOGO_PATH):
        try:
            run = p.add_run()
            run.add_picture(LOGO_PATH, width=Inches(1.65))
        except Exception:
            pass

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(25)
    p_title.paragraph_format.space_after = Pt(8)
    run_title = p_title.add_run("blynt")
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(38)
    run_title.font.bold = True
    run_title.font.color.rgb = NAVY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(12)
    run_sub = p_sub.add_run("SECURITY, SOC 2, PENETRATION TESTING & GRC SPECIFICATION")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(16)
    run_sub.font.bold = True
    run_sub.font.color.rgb = NAVY

    p_tagline = doc.add_paragraph()
    p_tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_tagline.paragraph_format.space_after = Pt(20)
    r_tagline = p_tagline.add_run("SOC 2 Type II Trust Services Criteria • Threat Modeling & Penetration Testing\nOWASP Top 10 Mitigation Matrix • UK HMRC MTD & GDPR Governance • 24/7 SOC Operations\nAuthoritative Information Security & GRC Manual • October 2026")
    r_tagline.font.name = "Segoe UI"
    r_tagline.font.size = Pt(11)
    r_tagline.font.color.rgb = CORAL

    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tbl.cell(0, 0)
    set_cell_background(c, "EEF2F9")
    set_cell_margins(c, top=100, bottom=100, left=180, right=180)
    p_in = c.paragraphs[0]
    p_in.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_in = p_in.add_run("Information Security & Compliance Governance Scope\n")
    r_in.font.name = "Segoe UI"
    r_in.font.size = Pt(12)
    r_in.font.bold = True
    r_in.font.color.rgb = NAVY
    r_in2 = p_in.add_run("This standalone specification sets forth the comprehensive information security architecture, SOC 2 Type II compliance controls, third-party penetration testing protocols, statutory UK GRC frameworks, and 24/7 Security Operations Center (SOC) runbooks for the blynt platform.")
    r_in2.font.name = "Segoe UI"
    r_in2.font.size = Pt(10)
    r_in2.font.italic = True
    r_in2.font.color.rgb = SLATE

    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_meta.paragraph_format.space_before = Pt(30)
    
    meta_lines = [
        ("Document Ref", "BLYNT-SEC-GRC-V1"),
        ("System Name", "blynt (Internal Code: Ledgerline)"),
        ("Compliance Standard", "SOC 2 Type II (Security, Availability, Confidentiality, Processing Integrity)"),
        ("Data Sovereignty", "AWS London (eu-west-2) • UK GDPR & Data Protection Act 2018 Compliant"),
        ("Statutory Tax Alignment", "HMRC Making Tax Digital (MTD) Anti-Fraud Security Specifications"),
        ("Penetration Testing Standard", "CREST / CHECK Certified Annual Red-Team Penetration Testing"),
        ("Classification", "Confidential Information Security & GRC Specification"),
    ]
    for label, val in meta_lines:
        r_lbl = p_meta.add_run(f"{label}: ")
        r_lbl.font.name = "Segoe UI"
        r_lbl.font.size = Pt(9.5)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = NAVY
        
        r_v = p_meta.add_run(f"{val}\n")
        r_v.font.name = "Segoe UI"
        r_v.font.size = Pt(9.5)
        r_v.font.color.rgb = CHARCOAL

    doc.add_page_break()

def format_inline_text(paragraph, text):
    tokens = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**'):
            run = paragraph.add_run(token[2:-2])
            run.font.bold = True
            run.font.name = "Segoe UI"
        elif token.startswith('*') and token.endswith('*'):
            run = paragraph.add_run(token[1:-1])
            run.font.italic = True
            run.font.name = "Segoe UI"
        elif token.startswith('`') and token.endswith('`'):
            run = paragraph.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(180, 40, 40)
        else:
            run = paragraph.add_run(token)
            run.font.name = "Segoe UI"

def resolve_image_path(raw_path):
    if os.path.exists(raw_path):
        return raw_path
    p1 = os.path.join(DIAGRAMS_DIR, os.path.basename(raw_path))
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(DOCS_DIR, raw_path)
    if os.path.exists(p2):
        return p2
    p3 = os.path.join(WORKSPACE_DIR, raw_path)
    if os.path.exists(p3):
        return p3
    return None

def parse_markdown_to_docx(doc, md_content):
    lines = md_content.splitlines()
    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    def flush_table():
        nonlocal in_table, table_rows
        if not table_rows:
            in_table = False
            return
        
        num_cols = max(len(r) for r in table_rows)
        if num_cols == 0:
            in_table = False
            table_rows = []
            return

        table = doc.add_table(rows=len(table_rows), cols=num_cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        for r_idx, row_data in enumerate(table_rows):
            is_header = (r_idx == 0)
            row = table.rows[r_idx]
            for c_idx in range(num_cols):
                cell_text = row_data[c_idx] if c_idx < len(row_data) else ""
                cell = row.cells[c_idx]
                set_cell_margins(cell, top=65, bottom=65, left=95, right=95)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                
                if is_header:
                    set_cell_background(cell, "162D5F")
                    run = p.add_run(cell_text.strip())
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.name = "Segoe UI"
                    run.font.size = Pt(9.5)
                else:
                    if r_idx % 2 == 1:
                        set_cell_background(cell, "F8FAFC")
                    else:
                        set_cell_background(cell, "FFFFFF")
                    format_inline_text(p, cell_text.strip())
                    for run in p.runs:
                        run.font.size = Pt(9)
        
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(4)
        in_table = False
        table_rows = []

    def flush_code():
        nonlocal in_code_block, code_lines
        if not code_lines:
            in_code_block = False
            return
        
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=75, bottom=75, left=110, right=110)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run("\n".join(code_lines))
        run.font.name = "Consolas"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(30, 41, 59)
        
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(4)
        in_code_block = False
        code_lines = []

    for line in lines:
        stripped = line.strip()

        img_match = re.match(r'!\[(.*?)\]\((.*?)\)', stripped)
        if img_match and not in_code_block:
            if in_table:
                flush_table()
            caption, img_raw = img_match.groups()
            resolved = resolve_image_path(img_raw)
            if resolved:
                try:
                    p_img = doc.add_paragraph()
                    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_img.paragraph_format.space_before = Pt(10)
                    p_img.paragraph_format.space_after = Pt(2)
                    r_img = p_img.add_run()
                    r_img.add_picture(resolved, width=Inches(5.8))
                    
                    if caption:
                        p_cap = doc.add_paragraph()
                        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_cap.paragraph_format.space_before = Pt(2)
                        p_cap.paragraph_format.space_after = Pt(10)
                        r_cap = p_cap.add_run(caption)
                        r_cap.font.name = "Segoe UI"
                        r_cap.font.size = Pt(9)
                        r_cap.font.italic = True
                        r_cap.font.color.rgb = SLATE
                except Exception as e:
                    print(f"Error embedding image {resolved}: {e}")
            continue

        if stripped.startswith("```"):
            if in_code_block:
                flush_code()
            else:
                if in_table:
                    flush_table()
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            parts = [p.strip() for p in stripped.split("|")[1:-1]]
            if all(set(p).issubset({'-', ':', ' '}) and len(p) > 0 for p in parts):
                continue
            in_table = True
            table_rows.append(parts)
            continue
        elif in_table:
            flush_table()

        if not stripped:
            continue

        if stripped in ["---", "***", "___"]:
            doc.add_paragraph().paragraph_format.space_after = Pt(6)
            continue

        if stripped.startswith("> "):
            quote_text = stripped[2:].strip()
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl.cell(0, 0)
            set_cell_background(cell, "EEF2F9")
            set_cell_margins(cell, top=70, bottom=70, left=130, right=130)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, quote_text)
            for r in p.runs:
                r.font.size = Pt(9.5)
                r.font.italic = True
                r.font.color.rgb = NAVY
            p_space = doc.add_paragraph()
            p_space.paragraph_format.space_after = Pt(4)
            continue

        if stripped.startswith("# CHAPTER") or stripped.startswith("# SECTION") or (stripped.startswith("# ") and stripped[2:3].isdigit()):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped.lstrip('#').strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[3:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[4:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.color.rgb = CORAL
            continue

        if stripped.startswith("# "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(stripped[2:].strip())
            run.font.name = "Segoe UI"
            run.font.size = Pt(16)
            run.font.bold = True
            run.font.color.rgb = NAVY
            continue

        if stripped.startswith("* ") or stripped.startswith("- "):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            format_inline_text(p, stripped[2:].strip())
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        format_inline_text(p, stripped)

    if in_code_block:
        flush_code()
    if in_table:
        flush_table()

def main():
    content = """# blynt — Security, SOC 2, Penetration Testing & GRC Specification

**Document Classification:** Information Security Architecture, Compliance & Assurance  
**Target Platform:** blynt Financial Operating System (`apps/api`, `apps/web`, AWS `eu-west-2` London)  
**Governance Frameworks:** SOC 2 Type II, ISO/IEC 27001:2022, HMRC Making Tax Digital (MTD), UK GDPR  
**Version:** 1.0 Production Readiness  
**Document Ref:** `BLYNT-SEC-GRC-V1`  

---

# Table of Contents
* **1. Enterprise Security Architecture & Defense-in-Depth Charter**
  * 1.1 Core Security Principles (Zero Trust, Least Privilege, Mathematical Invariance)
  * 1.2 Information Security Governance & Executive Accountability
  * 1.3 Perimeter, Network & Container Isolation (AWS eu-west-2 London)
* **2. SOC 2 Type II Compliance Framework (Trust Services Criteria)**
  * 2.1 Category 1: Security (Common Criteria CC1.0 – CC9.0)
  * 2.2 Category 2: Availability (Multi-AZ, 99.95% SLO, RPO = 0, RTO < 30m)
  * 2.3 Category 3: Processing Integrity (Zero-Drift Engine & Invariant Verification)
  * 2.4 Category 4: Confidentiality (AES-256 KMS, TLS 1.3 & Composite Tenant Isolation)
  * 2.5 Category 5: Privacy (UK Data Protection Act 2018 & UK GDPR Compliance)
* **3. Penetration Testing & Vulnerability Management**
  * 3.1 Third-Party Penetration Testing Methodology (CREST / CHECK Certified)
  * 3.2 The OWASP Top 10 Security Hardening Matrix
  * 3.3 Static & Dynamic Security Testing (SAST/DAST) in CI/CD Quality Gates
  * 3.4 Vulnerability Remediation SLAs & Responsible Disclosure Policy
* **4. Governance, Risk & Compliance (GRC) Architecture**
  * 4.1 Threat Modeling Framework (STRIDE Methodology)
  * 4.2 5x5 Enterprise Risk Assessment Matrix & Risk Register
  * 4.3 Statutory UK Compliance: HMRC Making Tax Digital (MTD) Anti-Fraud Headers
  * 4.4 Companies Act 2006 Statutory 6-Year Immutable Record Retention
  * 4.5 ISO/IEC 27001:2022 Control Alignment Matrix
* **5. Security Operations Center (SOC) & Incident Response**
  * 5.1 24/7 SIEM & Centralized Log Ingestion Architecture
  * 5.2 Security Incident Severity Matrix (SEV-1 to SEV-4)
  * 5.3 Forensic Audit Trail Integrity Verification (`trg_audit_logs_immutable`)
  * 5.4 Incident Response Lifecycle: Containment, Eradication & Post-Mortem

---

# 1. Enterprise Security Architecture & Defense-in-Depth Charter

Financial double-entry ledger platforms are primary targets for malicious actors seeking illicit funds transfer, extortion, or competitive data exfiltration. The security posture of blynt is engineered with institutional rigor.

![Figure Security - Security architecture, SOC 2 framework and GRC matrix](diagrams/figure_security_grc_soc_architecture.png)

## 1.1 Core Security Principles

1. **Zero Trust Architecture:** Every request is authenticated, authorized, and tenant-scoped at every layer. Perimeter networks are assumed to be hostile.
2. **Mathematical Invariance as a Security Boundary:** The application and database engines reject any transaction that violates double-entry balance ($\sum \text{Debits} == \sum \text{Credits}$), preventing fraudulent out-of-thin-air balance generation.
3. **Immutability of Historical Evidence:** Accounting journals and audit logs cannot be modified or deleted. Reversals must be executed as GAAP-compliant counter-balancing entries.
4. **Least Privilege Enforcement:** Every user, microservice, and AWS IAM role operates with the absolute minimum permissions required.

## 1.2 Information Security Governance & Executive Accountability

```
[ Board of Directors & Chief Information Security Officer (CISO) ]
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
[ Security Engineering & SecOps ]   [ Risk, Compliance & Data Protection ]
  ├── AppSec & SAST/DAST Gates        ├── SOC 2 Type II Compliance Auditor
  ├── Penetration Testing Lead        ├── UK GDPR Data Protection Officer (DPO)
  └── 24/7 SIEM Incident Responder    └── HMRC MTD Regulatory Liaison
```

## 1.3 Perimeter, Network & Container Isolation (AWS eu-west-2 London)

* **Physical Data Sovereignty:** All production databases, replicas, backups, and container instances reside strictly within AWS London (`eu-west-2`).
* **AWS WAF & Shield Advanced:** Protects public endpoints against DDoS attacks, automated credential stuffing, and SQLi/XSS probing.
* **VPC Subnet Tiering:**
  * **Public Ingress Subnet:** AWS Amplify / CloudFront edge and App Runner load balancers.
  * **Private Application Subnet:** NestJS 11 backend containers with zero direct public IP addresses.
  * **Isolated Database Subnet:** Amazon RDS PostgreSQL 16 Multi-AZ clusters with strictly internal access via Security Groups (Port 5432).
* **Non-Root Docker Hardening:** Backend Docker containers run as non-privileged user (`UID 1001`), with read-only root filesystems and dropped Linux capabilities.

---

# 2. SOC 2 Type II Compliance Framework (Trust Services Criteria)

blynt aligns directly with the American Institute of CPAs (AICPA) Trust Services Criteria for SOC 2 Type II compliance:

## 2.1 Category 1: Security (Common Criteria CC1.0 – CC9.0)

| SOC 2 Criteria | Institutional Control in blynt | Evidence Artifact |
| :--- | :--- | :--- |
| **CC6.1: Logical Access** | Multi-factor authentication (MFA) supported. Bearer token sessions validated in `user_sessions` with sliding expiration. | `auth.guard.ts`, `session.service.ts` |
| **CC6.2: User Registration** | RBAC hierarchy (`OWNER`, `ADMINISTRATOR`, `ACCOUNTANT`, `BOOKKEEPER`, `VIEWER`). Least privilege route guards. | `roles.guard.ts`, `roles.constants.ts` |
| **CC6.6: Perimeter Protection** | AWS WAF, Security Groups, private VPC subnets. All ingress over TLS 1.3. | Terraform VPC & WAF configurations |
| **CC6.7: Data Transmission** | HTTPS forced with HSTS header (`max-age=31536000; includeSubDomains; preload`). | `helmet.config.ts` |
| **CC7.1: Vulnerability Mgmt** | CI/CD automated gates fail if `npm audit` or Snyk detects high/critical vulnerabilities. | `.github/workflows/ci.yml` |

## 2.2 Category 2: Availability (99.95% SLO, RPO = 0, RTO < 30m)

* **Multi-AZ High Availability:** Amazon RDS PostgreSQL 16 configured with synchronous replication across multiple Availability Zones in `eu-west-2`.
* **Zero Recovery Point Objective ($RPO = 0$):** Continuous Write-Ahead Log (WAL) streaming guarantees zero financial transaction data loss during instance failover.
* **Rapid Recovery Time Objective ($RTO < 30\text{m}$):** Automated standby promotion in under 60 seconds; regional disaster recovery failover executed via automated runbook.

## 2.3 Category 3: Processing Integrity

* **Fixed-Point Precision Math:** Financial arithmetic executed via `MoneyService` wrapping `Decimal.js` configuring 4 decimal places (`NUMERIC(19,4)`), eliminating floating-point rounding drift.
* **15 Accounting Invariants:** Evaluated atomically by `JournalValidationService` prior to General Ledger commit.
* **Idempotency Gate:** All financial posting endpoints verify idempotency keys to prevent duplicate transaction execution on network retries.

## 2.4 Category 4: Confidentiality

* **Data-at-Rest Encryption:** AES-256 encryption across all Amazon RDS instances, EBS volumes, and S3 backup buckets using AWS KMS Customer Managed Keys (CMK).
* **Multi-Tenant Logical Isolation:** Enforced at the database relational layer using composite foreign keys `(organization_id, id)`. A database query in Organisation A cannot physically address records in Organisation B.

## 2.5 Category 5: Privacy (UK GDPR & Data Protection Act 2018)

* **Data Minimization:** Financial records retain only commercial counterparties and verified contact people.
* **Right to Erasure vs. Statutory Accounting Invariant:**
  * Personal identifiable information (PII) on contacts may be sanitized upon formal GDPR request.
  * **Statutory Compliance Override:** Posted journal entries, amounts, and dates are legally exempt from erasure under UK Companies Act 2006 Section 386 and HMRC Notice 700/21, preserving immutable ledger integrity.

---

# 3. Penetration Testing & Vulnerability Management

## 3.1 Third-Party Penetration Testing Methodology

blynt undergoes annual third-party penetration testing conducted by independent, CREST- and CHECK-certified security testing organizations.

* **Methodology Standards:** Testing adheres to the Open Source Security Testing Methodology Manual (OSSTMM) and OWASP Web Security Testing Guide (WSTG v4.2).
* **Assessment Scope:**
  1. **Black-Box Testing:** External unauthenticated probing of public APIs, rate limits, and WAF bypasses.
  2. **Gray-Box Testing:** Authenticated testing across all 5 roles (`VIEWER` through `OWNER`) testing for horizontal and vertical privilege escalation (BOLA/IDOR).
  3. **White-Box Code Audit:** Source code analysis of `src/accounting-engine/` and authentication guards.

## 3.2 The OWASP Top 10 Security Hardening Matrix

| OWASP Top 10 Vulnerability | Attack Vector in Accounting Software | Specific blynt Technical Defense |
| :--- | :--- | :--- |
| **A01: Broken Access Control (IDOR / BOLA)** | Tenant A attempts to view or post journals into Tenant B by guessing UUIDs. | **Composite Foreign Keys:** Database engine enforces `(organization_id, id)` constraints. `RolesGuard` verifies tenant membership on every route. |
| **A02: Cryptographic Failures** | Interception of plain-text passwords or session tokens. | **`scrypt` Hashing:** 16-byte random salt, 64-byte key length. `crypto.timingSafeEqual` constant-time verification. TLS 1.3 strict transport. |
| **A03: Injection (SQL Injection)** | Attacker injects SQL payload via search inputs or journal narrations. | **Prisma ORM:** 100% of queries use parameterized prepared statements. Raw SQL strictly limited to parameterized `$queryRaw`. |
| **A04: Insecure Design** | Attacker bypasses UI to post unbalanced journals ($Debits \ne Credits$). | **`JournalValidationService`:** Server-side mathematical validation checks 15 invariants inside an atomic row-locked transaction. |
| **A05: Security Misconfiguration** | Unnecessary HTTP headers, directory listing, or permissive CORS. | **`Helmet.js`:** Enforces CSP, HSTS, X-Frame-Options (`DENY`). Strict CORS origin matching active domain. |
| **A06: Vulnerable Components** | Known CVEs in npm third-party packages. | **CI/CD Quality Gate:** `npm audit --omit=dev` and Snyk scans fail PRs with high or critical vulnerabilities. |
| **A07: Identification & Auth Failures** | Brute-force credential stuffing attacks against login endpoints. | **Rate Limiter Middleware:** Max 5 attempts per minute per IP; exponential backoff and session lockouts. |
| **A08: Software & Data Integrity** | Database administrator manually updates historical journal rows. | **Statutory Immutability Trigger:** PostgreSQL trigger `trg_audit_logs_immutable` raises statutory exception on any UPDATE/DELETE. |
| **A09: Logging & Monitoring Failures** | Unauthorized actions occur without an audit trail. | **Structured Logging:** Every mutating action emits an `AuditLog` record with actor, organization, request ID, and state deltas. |
| **A10: Server-Side Request Forgery** | Webhook system exploited to probe internal AWS metadata (`169.254.169.254`). | **Egress Filtering:** Outbound HTTP requests restricted via VPC egress security groups; internal IP ranges blocked. |

## 3.3 Static & Dynamic Security Testing (SAST/DAST) in CI/CD

Every Pull Request must pass automated security scanners in GitHub Actions:
```bash
# 1. Dependency security audit
npm audit --audit-level=high --omit=dev

# 2. Static application security testing (SAST)
npx eslint . --max-warnings=0

# 3. Prisma schema relation verification
npx prisma validate
```

## 3.4 Vulnerability Remediation SLAs

| CVSS v3.1 Severity Score | Categorization | Mandatory Remediation SLA | Escalation Target |
| :--- | :--- | :--- | :--- |
| **9.0 – 10.0** | **CRITICAL** | **< 24 Hours** (Emergency Hotfix Release) | CISO & Lead Architect |
| **7.0 – 8.9** | **HIGH** | **< 7 Calendar Days** | Tech Lead & SecOps Engineer |
| **4.0 – 6.9** | **MEDIUM** | **< 30 Calendar Days** (Next Sprint Release) | Assigned Product Engineer |
| **0.1 – 3.9** | **LOW** | **< 90 Calendar Days** | Backlog Refinement |

---

# 4. Governance, Risk & Compliance (GRC) Architecture

## 4.1 Threat Modeling Framework (STRIDE Methodology)

| Threat Category | Potential Risk Scenario | blynt Architectural Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates legitimate accountant. | Bearer token validated against active `user_sessions`; session revokes on password reset. |
| **Tampering** | Rogue actor alters historical journal debits/credits. | Hardened relational database constraints; GAAP reversal non-destructive counter-entries. |
| **Repudiation** | User denies having posted an invoice or locked a period. | Append-only `audit_logs` record capturing actor ID, timestamp, IP address, and request ID. |
| **Information Disclosure** | Data leak between multi-tenant accounts. | Composite foreign keys `(organization_id, id)` block cross-tenant queries at SQL engine layer. |
| **Denial of Service** | Resource exhaustion via complex reporting queries. | Database query pagination, connection pooling via PgBouncer, statement timeouts (10s max). |
| **Elevation of Privilege** | Bookkeeper invokes accountant-only hard-lock route. | `RolesGuard` strictly inspects user's verified role against endpoint `@Roles(...)` metadata. |

## 4.2 5x5 Enterprise Risk Assessment Matrix

```
   IMPACT ───>
   Likelihood   1 (Insignif)   2 (Minor)   3 (Moderate)   4 (Major)   5 (Catastrophic)
   5 (Frequent)   Low          Medium      High           Critical    Critical
   4 (Likely)     Low          Medium      High           High        Critical
   3 (Possible)   Low          Low         Medium         High        High
   2 (Unlikely)   Low          Low         Low            Medium      High
   1 (Rare)       Low          Low         Low            Low         Medium
```

* **Target Residual Risk:** Zero "Critical" or "High" risks permitted in production without formal CISO risk acceptance and documented compensating controls.

## 4.3 Statutory UK Compliance: HMRC Making Tax Digital (MTD) Anti-Fraud Headers

To comply with statutory UK HMRC Making Tax Digital specifications, all outbound HMRC API requests automatically bundle mandatory anti-fraud headers:

```http
Gov-Client-Connection-Method: WEB_APP_VIA_SERVER
Gov-Client-Device-ID: 7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d
Gov-Client-User-IDs: os=windows&user=blynt_accountant_42
Gov-Client-Timezone: UTC+01:00
Gov-Client-Local-IPs: 192.168.1.50
Gov-Client-Public-IP: 198.51.100.25
Gov-Vendor-Version: blynt=1.0.4&engine=nestjs-11
```

## 4.4 Companies Act 2006 Statutory 6-Year Immutable Record Retention

Under UK Companies Act 2006 Section 388 and HMRC VAT Notice 700/21:
* Accounting records and audit trails must be retained for **6 years from the end of the last financial year they relate to**.
* AWS S3 backup buckets are configured with **AWS S3 Object Lock in Compliance Mode** (WORM: Write Once, Read Many).
* Automated lifecycle policies prevent any deletion—even by root AWS account credentials—until the statutory retention period expires.

## 4.5 ISO/IEC 27001:2022 Control Alignment Matrix

| ISO 27001:2022 Control | Control Name | blynt Implementation |
| :--- | :--- | :--- |
| **A.5.15** | Access Control | Role-Based Access Control (`RolesGuard`) and tenant isolation. |
| **A.5.23** | Cloud Security | AWS Infrastructure as Code with least-privilege IAM policies. |
| **A.8.7** | Malware Protection | Container image vulnerability scanning via Amazon ECR. |
| **A.8.8** | Vulnerability Mgmt | Continuous Snyk and Dependabot scanning in GitHub Actions CI. |
| **A.8.9** | Configuration Mgmt | Centralized configuration via validated environment schemas (`env.ts`). |
| **A.8.24** | Use of Cryptography | AES-256 KMS storage encryption; `scrypt` password hashing; TLS 1.3. |

---

# 5. Security Operations Center (SOC) & Incident Response

## 5.1 24/7 SIEM & Centralized Log Ingestion Architecture

```
[ Application Logs (apps/api) ] ──> [ AWS CloudWatch Logs (JSON) ] ──> [ Metric Filter Alarms ]
[ RDS Audit & Query Logs ]      ──> [ AWS CloudWatch Logs ]       ──> [ Amazon GuardDuty ]
[ AWS CloudTrail API Audit ]    ──> [ Amazon S3 Encrypted Vault ] ──> [ AWS Security Hub ]
                                                                             │
                                                                             ▼
                                                                [ PagerDuty SEV-1/SEV-2 Alert ]
                                                                [ Slack #security-alerts ]
```

* **Correlation ID Tracing:** Every incoming HTTP request is assigned a unique `x-request-id` UUIDv4. All log lines, audit entries, and database exceptions retain this correlation ID.

## 5.2 Security Incident Severity Matrix

| Severity Level | Definition | Response SLA | Response Team |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Active data exfiltration, tenant boundary breach, or database tampering attempt. | **< 15 Minutes** (24/7 PagerDuty) | Incident Commander, CISO, Lead Architect |
| **SEV-2 (Major)** | Repeated brute-force authentication attacks, WAF rule trigger spike, or component failure. | **< 30 Minutes** | SecOps Engineer, On-Call Developer |
| **SEV-3 (Moderate)** | Suspicious IP probing, non-critical dependency vulnerability, or policy violation. | **< 4 Hours** | Assigned Security Engineer |
| **SEV-4 (Minor)** | Informational alert, routine credential rotation notification. | **< 2 Business Days** | Standard Sprint Backlog |

## 5.3 Forensic Audit Trail Integrity Verification

The PostgreSQL trigger `trg_audit_logs_immutable` protects audit records against tampering:

```sql
-- Monthly automated verification probe:
UPDATE audit_logs 
SET action = 'MALICIOUS_TAMPER' 
WHERE id = (SELECT id FROM audit_logs LIMIT 1);

-- Verified Outcome:
-- ERROR: Statutory Compliance Violation: audit_logs are immutable and cannot be updated or deleted
```

## 5.4 Incident Response Lifecycle

```
[ 1. DETECTION ] ──> [ 2. TRIAGE ] ──> [ 3. CONTAINMENT ] ──> [ 4. ERADICATION ] ──> [ 5. RECOVERY ] ──> [ 6. POST-MORTEM ]
```

1. **Detection:** Automated alert raised via AWS GuardDuty, CloudWatch metric filter, or synthetic health probe.
2. **Triage:** Incident Commander verifies threat validity and classifies severity level (SEV-1 to SEV-4).
3. **Containment:**
   * Isolate compromised user session: `DELETE FROM user_sessions WHERE user_id = '<ID>';`.
   * Block malicious IP at AWS WAF layer.
4. **Eradication:** Patch root cause vulnerability via emergency hotfix branch (`hotfix/BLYNT-SEC-XXX`).
5. **Recovery:** Deploy verified container image; execute `AccountingIntegrityService.checkIntegrity()` verifying zero financial drift.
6. **Post-Mortem:** Conduct blameless root cause analysis (RCA) documented in Confluence Space `OPS` within 24 hours.

---

# END OF BLYNT SECURITY, SOC 2, PENETRATION TESTING & GRC SPECIFICATION
"""

    print("Writing BLYNT_SECURITY_SOC2_PENTEST_GRC.md...")
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"File created: {OUTPUT_MD} ({len(content)} bytes)")

    doc = Document()
    for sec in doc.sections:
        sec.top_margin = Inches(0.9)
        sec.bottom_margin = Inches(0.9)
        sec.left_margin = Inches(0.9)
        sec.right_margin = Inches(0.9)

    print("Adding cover page...")
    add_cover_page(doc)

    print("Parsing security markdown into Word docx...")
    parse_markdown_to_docx(doc, content)

    print(f"Saving to {OUTPUT_DOCX}...")
    doc.save(OUTPUT_DOCX)
    print("Word document generated successfully!")

if __name__ == "__main__":
    main()
