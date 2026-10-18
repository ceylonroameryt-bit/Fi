import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 810, "Blynt — Complete 50-Phase Product Roadmap")
            self.drawRightString(A4[0] - 36, 810, "Architecture Blueprint")
            self.setStrokeColor(colors.HexColor("#162D5F"))
            self.setLineWidth(1)
            self.line(36, 804, A4[0] - 36, 804)

        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 38, A4[0] - 36, 38)
        
        self.drawString(36, 26, "Blynt — Small Business Cloud Accounting SaaS")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 26, page_str)
        self.restoreState()


ROADMAP_DATA = [
    {
        "category": "Category 1: Platform & Access",
        "items": [
            ("1", "Project & Database Foundation", "Application structure, database setup and core configuration.", "Done"),
            ("2", "Authentication & Sessions", "Secure login, session handling, token validation and logout.", "In Progress"),
            ("3", "Multi-Organisation Support", "Separate businesses and isolate each organisation's data.", "Done"),
            ("4", "Role-Based Permissions", "Enforce access rights for owners, administrators, accountants, bookkeepers and viewers.", "Done"),
        ]
    },
    {
        "category": "Category 2: Core Accounting",
        "items": [
            ("5", "Chart of Accounts", "Create and manage asset, liability, equity, revenue and expense accounts.", "Done"),
            ("6", "Financial Years & Periods", "Configure financial years, accounting periods and period-locking rules.", "Done"),
            ("7", "Manual Journals", "Create accounting journals with debit and credit lines.", "Done"),
            ("8", "Journal Validation", "Check balancing, account validity, period status and journal rules.", "Done"),
            ("9", "Posting Engine", "Post validated journals to the ledger through one central engine.", "Done"),
            ("10", "Journal Reversals", "Correct posted transactions using traceable reversal journals.", "Done"),
        ]
    },
    {
        "category": "Category 3: Ledger & Reporting",
        "items": [
            ("11", "General Ledger", "View account-level transactions and running balances.", "Done"),
            ("12", "Trial Balance", "Compare debit and credit totals across accounts.", "Done"),
            ("13", "Audit & Integrity", "Record important changes and protect accounting history.", "Done"),
            ("14", "Financial Reports", "Complete financial statements and reporting calculations.", "In Progress"),
            ("29", "Reporting Enhancements", "Improve report filters, period selection and report coverage.", "In Progress"),
            ("30", "Export Engine", "Export reports and data safely, with correct pagination and formatting.", "In Progress"),
        ]
    },
    {
        "category": "Category 4: Testing & Security",
        "items": [
            ("15", "Financial Testing", "Test double-entry accounting, decimal accuracy, posting and reversals.", "In Progress"),
            ("16", "Security Hardening", "Fix authentication, configuration, permissions and release-security gaps.", "In Progress"),
            ("37", "Production Security & Compliance", "Strengthen production secrets, access controls, auditability and data protection.", "In Progress"),
            ("39", "Complete Testing & Integrity", "Run automated tests, database integration tests and end-to-end financial checks.", "In Progress"),
        ]
    },
    {
        "category": "Category 5: Sales & Receivables",
        "items": [
            ("17", "Customer & Supplier Contacts", "Manage customer and supplier details.", "Done"),
            ("18", "Sales Invoices", "Create invoices, calculate totals and connect sales to accounting.", "In Progress"),
            ("19", "Customer Payments", "Record receipts and allocate payments against invoices.", "Pending"),
            ("20", "Credit Notes & Refunds", "Handle invoice corrections, credit notes and customer refunds.", "Pending"),
            ("21", "Accounts Receivable", "Track unpaid invoices, customer balances and overdue amounts.", "In Progress"),
        ]
    },
    {
        "category": "Category 6: Purchases & Payables",
        "items": [
            ("22", "Supplier Bills", "Create and manage purchase invoices separately from sales invoices.", "Pending"),
            ("23", "Supplier Payments", "Record supplier payments and allocate them against bills.", "Pending"),
            ("24", "Accounts Payable", "Track supplier balances, outstanding bills and amounts due.", "In Progress"),
            ("25", "Expenses & Receipts", "Record business expenses and attach supporting receipts.", "Pending"),
        ]
    },
    {
        "category": "Category 7: VAT, Tax & Banking",
        "items": [
            ("26", "Central VAT & Tax Engine", "Apply configurable tax codes, VAT rules and tax calculations consistently.", "Pending"),
            ("27", "Bank Transaction Import", "Import bank statements and transaction files.", "Pending"),
            ("28", "Bank Reconciliation", "Match bank transactions with accounting records and investigate differences.", "Pending"),
        ]
    },
    {
        "category": "Category 8: Documents & Business Workflows",
        "items": [
            ("31", "Documents & Attachments", "Store and link invoices, receipts and other business documents securely.", "In Progress"),
            ("32", "Email & Notifications", "Send invoice emails, payment reminders and system notifications.", "In Progress"),
            ("33", "Approval Workflows", "Require appropriate approval for selected transactions and actions.", "Pending"),
            ("34", "Period Closing", "Review balances and safely lock accounting periods.", "In Progress"),
            ("35", "Year-End Accounting", "Support year-end adjustments, closing entries and opening balances.", "Pending"),
            ("36", "External Integrations", "Connect banking, payment, tax or other external services where required.", "Pending"),
        ]
    },
    {
        "category": "Category 9: Infrastructure & Release",
        "items": [
            ("38", "AWS Production Infrastructure", "Configure hosting, database, backups, monitoring and deployment in AWS.", "Pending"),
            ("40", "Beta & Commercial Release", "Prepare onboarding, production checks, documentation and the customer launch.", "Pending"),
        ]
    },
    {
        "category": "Category 10: AI Document Intelligence",
        "items": [
            ("41", "AI Prototype Safety Audit", "Fix existing AI risks, including incorrect invoice direction, fabricated fields and unsafe tax defaults.", "Pending"),
            ("42", "Upload, Storage & OCR", "Build a reliable document upload and text-extraction pipeline.", "In Progress"),
            ("43", "Real LLM Provider", "Integrate a real language model instead of relying only on heuristic text matching.", "Pending"),
            ("44", "Background Processing", "Process documents asynchronously and manage retries and failures.", "Pending"),
            ("45", "Extraction Validation", "Validate invoice numbers, dates, totals, VAT and extracted fields before use.", "In Progress"),
            ("46", "Transaction & Entity Detection", "Identify sales versus purchases and resolve the correct customer or supplier.", "In Progress"),
            ("47", "Tax & Account Classification", "Suggest suitable tax codes, ledger accounts and classifications without unsafe defaults.", "In Progress"),
            ("48", "Human Review & Permissions", "Require authorised users to review AI suggestions before creating accounting drafts.", "In Progress"),
            ("49", "AI Evaluation & Regression Tests", "Measure extraction accuracy and test against known documents and failure cases.", "Verify"),
            ("50", "AI Monitoring & Rollout", "Monitor accuracy, failures, usage costs and rollout performance.", "Pending"),
        ]
    },
]

def build_pdf(filename="Blynt_Complete_50_Phase_Roadmap.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    # Custom typography
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#162D5F"),
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=12,
    )

    cat_style = ParagraphStyle(
        "CategoryHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.white,
    )

    col_header_style = ParagraphStyle(
        "ColHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#162D5F"),
    )

    cell_phase_style = ParagraphStyle(
        "CellPhase",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=1, # Center
        textColor=colors.HexColor("#334155"),
    )

    cell_name_style = ParagraphStyle(
        "CellName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#162D5F"),
    )

    cell_desc_style = ParagraphStyle(
        "CellDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
    )

    def status_badge_html(status):
        if status == "Done":
            bg = "#DCFCE7"
            fg = "#166534"
        elif status == "In Progress":
            bg = "#FFF1EE"
            fg = "#C2410C"
        elif status == "Verify":
            bg = "#F5F3FF"
            fg = "#6B21A8"
        else: # Pending
            bg = "#F1F5F9"
            fg = "#475569"
        return f'<font color="{fg}"><b>{status}</b></font>'

    cell_status_style = ParagraphStyle(
        "CellStatus",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=1, # Center
    )

    elements = []

    # Logo + Title Header row
    if os.path.exists("blynt-logo-horizontal.png"):
        logo_img = Image("blynt-logo-horizontal.png", width=138, height=40)
        header_table = Table([[logo_img, Paragraph("<b>Complete 50-Phase Product Roadmap</b><br/><font color='#64748B' size='8.5'>Core double-entry accounting, ledger compliance & AI document pipeline.</font>", styles["Normal"])]], colWidths=[150, 373])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(header_table)
    else:
        elements.append(Paragraph("Blynt — Complete 50-Phase Product Roadmap", title_style))
        elements.append(Paragraph("Comprehensive engineering, core double-entry accounting, ledger compliance & AI document pipeline.", subtitle_style))

    # Summary Metrics Card
    metrics_data = [
        [
            Paragraph('<font color="#64748B" size="7.5">TOTAL PHASES</font><br/><font color="#162D5F" size="13"><b>50</b></font>', styles["Normal"]),
            Paragraph('<font color="#166534" size="7.5">DONE</font><br/><font color="#166534" size="13"><b>13</b></font> <font color="#64748B" size="7.5">(26%)</font>', styles["Normal"]),
            Paragraph('<font color="#FF7F6C" size="7.5">IN PROGRESS</font><br/><font color="#C2410C" size="13"><b>19</b></font> <font color="#64748B" size="7.5">(38%)</font>', styles["Normal"]),
            Paragraph('<font color="#475569" size="7.5">PENDING</font><br/><font color="#475569" size="13"><b>17</b></font> <font color="#64748B" size="7.5">(34%)</font>', styles["Normal"]),
            Paragraph('<font color="#6B21A8" size="7.5">VERIFY</font><br/><font color="#6B21A8" size="13"><b>1</b></font> <font color="#64748B" size="7.5">(2%)</font>', styles["Normal"]),
        ]
    ]
    metrics_table = Table(metrics_data, colWidths=[104.6, 104.6, 104.6, 104.6, 104.6])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 12))

    # Render each category
    col_widths = [36, 134, 275, 78] # Total: 523pt

    for cat_idx, cat in enumerate(ROADMAP_DATA):
        cat_elements = []

        # Category Header Banner in Blynt Navy (#162D5F)
        cat_banner = Table(
            [[Paragraph(cat["category"], cat_style)]],
            colWidths=[523]
        )
        cat_banner.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#162D5F")),
            ('TOPPADDING', (0, 0), (-1, -1), 4.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        cat_elements.append(cat_banner)

        # Table data: Header row + Items
        rows = [
            [
                Paragraph("Phase", col_header_style),
                Paragraph("Phase Name", col_header_style),
                Paragraph("Summary / Scope", col_header_style),
                Paragraph("Status", col_header_style),
            ]
        ]

        t_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, 0), 4),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (3, 0), (3, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
        ]

        for idx, (p_num, p_name, p_desc, p_status) in enumerate(cat["items"], start=1):
            rows.append([
                Paragraph(p_num, cell_phase_style),
                Paragraph(p_name, cell_name_style),
                Paragraph(p_desc, cell_desc_style),
                Paragraph(status_badge_html(p_status), cell_status_style),
            ])

            # Alternating background colors
            bg_color = colors.HexColor("#F8FAFC") if idx % 2 == 1 else colors.white
            t_styles.append(('BACKGROUND', (0, idx), (-1, idx), bg_color))
            
            # Badge background color per cell (3, idx)
            if p_status == "Done":
                badge_bg = colors.HexColor("#DCFCE7")
            elif p_status == "In Progress":
                badge_bg = colors.HexColor("#DBEAFE")
            elif p_status == "Verify":
                badge_bg = colors.HexColor("#F3E8FF")
            else:
                badge_bg = colors.HexColor("#F1F5F9")
            t_styles.append(('BACKGROUND', (3, idx), (3, idx), badge_bg))

            t_styles.append(('TOPPADDING', (0, idx), (-1, idx), 4))
            t_styles.append(('BOTTOMPADDING', (0, idx), (-1, idx), 4))
            t_styles.append(('LEFTPADDING', (0, idx), (-1, idx), 6))
            t_styles.append(('RIGHTPADDING', (0, idx), (-1, idx), 6))

        table = Table(rows, colWidths=col_widths)
        table.setStyle(TableStyle(t_styles))
        cat_elements.append(table)
        cat_elements.append(Spacer(1, 10))

        elements.extend(cat_elements)

    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Blynt_Complete_50_Phase_Roadmap.pdf"
    build_pdf(out)
