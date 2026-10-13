import os
import subprocess
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(WORKSPACE_DIR, "docs")
SOURCE_DIR = os.path.join(DOCS_DIR, "15-standard-docs")
PDF_OUT_DIR = os.path.join(SOURCE_DIR, "pdf")
os.makedirs(PDF_OUT_DIR, exist_ok=True)

# Import helper functions from master script
from build_15_standard_docs_pdf import parse_markdown_to_docx

doc_files = [
    ("01_PROJECT_CHARTER.md", "Project Charter"),
    ("02_BUSINESS_REQUIREMENTS_DOCUMENT.md", "Business Requirements Document (BRD)"),
    ("03_PRODUCT_REQUIREMENTS_DOCUMENT.md", "Product Requirements Document (PRD)"),
    ("04_USER_STORIES_AND_ACCEPTANCE_CRITERIA.md", "User Stories & Acceptance Criteria"),
    ("05_SYSTEM_ARCHITECTURE_DOCUMENT.md", "System Architecture Document (SAD)"),
    ("06_DATABASE_SCHEMA_AND_ERD.md", "Database Schema & Relational ERD"),
    ("07_API_SPECIFICATION.md", "REST & Subledger API Specification"),
    ("08_ARCHITECTURE_DECISION_RECORDS.md", "Architecture Decision Records (ADRs)"),
    ("09_UI_UX_DESIGN_SPECIFICATION.md", "UI/UX Design & Human Interface Spec"),
    ("10_THREAT_MODEL_AND_SECURITY_PLAN.md", "Threat Model & Security Plan"),
    ("11_COMPLIANCE_AND_PRIVACY_CHECKLIST.md", "Compliance, HMRC & Privacy Checklist"),
    ("12_DEPLOYMENT_AND_DEVOPS_RUNBOOK.md", "Deployment & DevOps SRE Runbook"),
    ("13_PROJECT_ROADMAP_AND_RELEASE_PLAN.md", "Project Roadmap & Release Plan"),
    ("14_RISK_REGISTER_RAID_LOG.md", "Risk Register & RAID Governance Log"),
    ("15_RACI_MATRIX.md", "RACI Governance Matrix")
]

ps_lines = [
    "$word = New-Object -ComObject Word.Application",
    "$word.Visible = $false",
    "try {"
]

for idx, (filename, title) in enumerate(doc_files, 1):
    fpath = os.path.join(SOURCE_DIR, filename)
    base_name = filename.replace(".md", "")
    docx_path = os.path.join(PDF_OUT_DIR, f"{base_name}.docx")
    pdf_path = os.path.join(PDF_OUT_DIR, f"{base_name}.pdf")

    doc = Document()
    for s in doc.sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    parse_markdown_to_docx(doc, content, idx, title)
    doc.save(docx_path)
    ps_lines.append(f"    $doc = $word.Documents.Open('{docx_path}')")
    ps_lines.append(f"    $doc.SaveAs([ref]'{pdf_path}', [ref]17)")
    ps_lines.append(f"    $doc.Close()")
    ps_lines.append(f"    Remove-Item '{docx_path}' -Force")

ps_lines.append("} finally {")
ps_lines.append("    $word.Quit()")
ps_lines.append("}")

ps_script = "\n".join(ps_lines)
subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
print(f"[+] Successfully generated individual PDFs in: {PDF_OUT_DIR}")
