# Blynt — Enterprise Jira & Confluence Professional Setup Guide

**Target Organization:** Blynt Financial Technologies  
**Target URL:** `https://blynt.atlassian.net`  
**Ecosystem:** Atlassian Jira Software Cloud + Confluence Cloud + GitHub Enterprise (`ceylonroameryt-bit/Fi`) + AWS App Runner CI/CD  
**Document Ref:** `BLYNT-PMO-SETUP-V1`  

---

## 1. Executive Setup Architecture

To deliver an institutional double-entry financial platform, project execution requires complete bi-directional traceability:

```
[ CONFLUENCE: PRD / Architecture RFC ]
              │ (1:1 Requirement Link)
              ▼
[ JIRA: 50-Phase Epics & Sprint Stories (BLYNT-XXX) ]
              │ (Branch: feature/BLYNT-10-vat-engine)
              ▼
[ GITHUB: ceylonroameryt-bit/Fi ]
              │ (PR opened -> Automated CI: Lint, Typecheck, 127 Tests)
              ▼
[ AWS APP RUNNER: Automated Staging & Production Deploy ]
              │ (Webhook callback)
              ▼
[ JIRA: Automatically Marked DONE / RELEASED ]
```

---

## 2. Phase 1: Atlassian Account & Site Creation (5 Minutes)

### Step 1: Sign Up for Atlassian Cloud
1. Navigate to: **[https://www.atlassian.com/try/cloud/signup](https://www.atlassian.com/try/cloud/signup)**
2. Select the **Jira Software + Confluence** bundle.
3. Sign up using your company administrator email (`admin@blynt.co` or primary Google Workspace).

### Step 2: Claim Your Site Domain
* In the **"Claim your site"** field, enter:
  ```
  blynt
  ```
* Your cloud workspace URL will be: **`https://blynt.atlassian.net`**

### Step 3: Choose Plan
* **Free Plan:** Supports up to 10 team members with complete Scrum boards, Jira automations, and Confluence spaces.
* **Standard Plan ($7.75/user/mo):** Adds audit logs, advanced user permissions, and 24/7 Atlassian support.

---

## 3. Phase 2: Jira Software Project Creation

1. In Jira, click **Projects** > **Create Project**.
2. Template: Select **Scrum**.
3. Project Type: Select **Company-managed** *(Crucial: Company-managed enables institutional workflow schemas, custom fields, and global automation)*.
4. Configure Details:
   * **Project Name:** `Blynt Engineering & Product`
   * **Project Key:** `BLYNT`

---

## 4. Phase 3: 1-Click Import of the 50-Phase Roadmap

We have generated an Atlassian-compliant CSV file located at:  
👉 [`docs/BLYNT_JIRA_IMPORT_50_PHASES.csv`](file:///d:/Project/F!/docs/BLYNT_JIRA_IMPORT_50_PHASES.csv)

### How to Import into Jira:
1. In Jira, click the **Settings (Cog Icon)** in the top right > **System**.
2. In the left navigation, select **External System Import** > **CSV**.
3. Choose the file: `D:\Project\F!\docs\BLYNT_JIRA_IMPORT_50_PHASES.csv`.
4. Select Project: **`Blynt Engineering & Product (BLYNT)`**.
5. Map the CSV fields as follows:
   * `Issue Type` $\rightarrow$ **Issue Type**
   * `Summary` $\rightarrow$ **Summary**
   * `Description` $\rightarrow$ **Description**
   * `Component/s` $\rightarrow$ **Component/s**
   * `Priority` $\rightarrow$ **Priority**
   * `Story Points` $\rightarrow$ **Story Points**
   * `Status` $\rightarrow$ **Status**
   * `Epic Name` $\rightarrow$ **Epic Name**
   * `Labels` $\rightarrow$ **Labels**
6. Click **Begin Import**.
7. **Result:** In 30 seconds, all 4 Milestones, 50 Epics (`BLYNT-EPIC-01` to `BLYNT-EPIC-50`), and foundational stories will be populated with estimates and labels.

---

## 5. Phase 4: Professional 6-Stage State Machine Workflow

Navigate to **Project Settings** > **Workflows** > **Edit Workflow**. Configure the 6 sequential stages:

```
┌─────────────┐       DoR Met       ┌───────────────────┐     Branch Created    ┌─────────────────┐
│ 1. BACKLOG  │ ──────────────────> │ 2. READY FOR DEV  │ ────────────────────> │ 3. IN PROGRESS  │
└─────────────┘                     └───────────────────┘                       └─────────────────┘
                                                                                         │
                                                                                         │ PR Opened
                                                                                         ▼
┌─────────────┐       DoD Signed    ┌───────────────────┐     PR Merged / CI    ┌─────────────────┐
│  6. DONE    │ <────────────────── │  5. QA / TESTING  │ <──────────────────── │ 4. CODE REVIEW  │
└─────────────┘                     └───────────────────┘                       └─────────────────┘
```

### Stage Definitions & Progression Rules:
1. **`BACKLOG`**: Work item captured and prioritized. Not committed.
2. **`READY FOR DEV`**:
   * **Gatekeeper:** Definition of Ready (DoR) checked. Requires Confluence PRD link, acceptance criteria, and Story Point estimation.
3. **`IN PROGRESS`**:
   * Engineer assigned. Work-in-Progress (WIP) limit = 1 per developer.
   * Triggered when Git branch `feature/BLYNT-XXX-description` is created.
4. **`CODE REVIEW`**:
   * Pull request opened in GitHub against `main`.
   * Automated CI pipeline must pass (TypeScript typecheck, lint, 127 tests).
   * Requires 2 senior peer approvals.
5. **`QA / TESTING`**:
   * Pull request merged to staging branch; deployed on AWS App Runner.
   * QA verifies manual test cases and regression matrix.
6. **`DONE / RELEASED`**:
   * Definition of Done (DoD) signed off.
   * Deployed to production AWS environment.
   * Release notes updated in Confluence.

---

## 6. Phase 5: Confluence Spaces Architecture

In Confluence (`https://blynt.atlassian.net/wiki`), click **Spaces** > **Create Space** and set up these 5 institutional spaces:

| Space Key | Space Name | Purpose | Key Content |
| :--- | :--- | :--- | :--- |
| **`ENG`** | **Engineering & Architecture** | Technical SSOT | Architecture Decision Records (ADRs), DB Schemas, API Specs, AWS Infrastructure |
| **`PROD`** | **Product Management** | Product Requirements | PRDs, Personas, 50-Phase Roadmap, Feature Specifications |
| **`QA`** | **Quality Assurance** | Test Governance | Test Strategies, 100 Test Cases Specification, Regression Reports |
| **`SEC`** | **Security & Compliance** | Statutory & Regulatory | HMRC MTD Certification, SOC 2, ISO 27001, GDPR Audit Logs |
| **`OPS`** | **Operations & SRE** | Production Reliability | AWS Playbooks, Runbooks, Disaster Recovery, SEV-1 Post-Mortems |

---

## 7. Phase 6: GitHub Integration & Smart Automation

### Step 1: Install "GitHub for Jira" App
1. In Jira, navigate to **Apps** > **Explore more apps**.
2. Search for **"GitHub for Jira"** (Official Atlassian app) and click **Get app**.
3. Authorize your GitHub account and select repository: **`ceylonroameryt-bit/Fi`**.

### Step 2: Smart Commits Syntax
Engineers can reference Jira issues directly in Git commits:
* **Comment:** `git commit -m "BLYNT-10 #comment Fixed 20% VAT rounding calculation"`
* **Time Tracking:** `git commit -m "BLYNT-10 #time 2h"`
* **Transition:** `git commit -m "BLYNT-10 #in-progress Started VAT return calculation"`

### Step 3: Jira Smart Automation Rules
Navigate to **Project Settings** > **Automation** and activate these rules:

1. **Auto-transition to IN PROGRESS**:
   * *When:* Branch created in GitHub starting with `feature/BLYNT-`
   * *Then:* Transition issue to **`IN PROGRESS`**
2. **Auto-transition to CODE REVIEW**:
   * *When:* Pull request opened in GitHub
   * *Then:* Transition issue to **`CODE REVIEW`**
3. **Auto-transition to QA / TESTING**:
   * *When:* Pull request merged into `main`
   * *Then:* Transition issue to **`QA / TESTING`**
4. **Auto-transition to DONE**:
   * *When:* Successful deployment to AWS App Runner production environment
   * *Then:* Transition issue to **`DONE`**
