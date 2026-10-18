import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const mdContent = `# Blynt — Business User Guide & Feature Manual
*A Non-Technical Guide for Business Owners, Managers & Accounting Teams*  
*Date: October 2026*

---

## Welcome to Blynt
Blynt is designed to make running your business finances straightforward, fast, and stress-free. You don't need an accounting degree or technical knowledge to get the most out of your financial data.

This manual explains how your system works, how to customize it to your personal routine, and how artificial intelligence (AI) handles the repetitive busywork so you can focus on growing your business.

---

## 1. Understanding Your Money: Transactions vs. Reconciliation

Many business owners wonder: *“What is the difference between my Transactions page and Bank Reconciliation?”*

### Bank Transactions (Your Daily Money In & Out)
- **What it is:** This is the live stream of everything passing through your bank account—sales deposits, client payments, software subscriptions, rent, and utility bills.
- **Your goal here:** Review each item, see who it was paid to or received from, confirm what category it belongs to (e.g., Software, Office Supplies, Sales Revenue), and click **Confirm**.
- **How AI helps:** Blynt automatically recognizes the merchant name and suggests the right category so you can confirm transactions with a single click.

### Bank Reconciliation (Your Periodic “Reality Check”)
- **What it is:** The financial sanity check where you compare your bank statement balance against your internal bookkeeping records to make sure nothing was missed, duplicated, or entered incorrectly.
- **Why it matters:** It gives you 100% confidence that the profit, tax, and cash numbers in your reports are accurate and audit-ready.

---

## 2. Personalizing Your Dashboard

Every business owner works differently. A founder might only want to see high-level cash and profit, while an operations manager needs quick access to invoice actions and bills due.

### How to Customize Your Screen
1. On your Dashboard, click the **Customize Dashboard** button right below your morning greeting.
2. You will see a list of cards and widgets with tick-boxes:
   - **Quick Action Buttons:** Fast shortcuts to create invoices, bills, payments, and contacts.
   - **KPI Numbers:** Six key figures (*Cash Balance*, *Income*, *Expenses*, *Net Profit*, *Unpaid Invoices*, and *Bills Due*).
   - **Charts:** 12-month Cash Flow graph and Income vs. Expenses breakdown.
   - **Recent Tables:** Latest transactions, outstanding invoices, and upcoming bills.
3. Simply **tick what you want to see** and **untick what you want to hide**.
4. Click **Save & Apply**. Your choices are automatically remembered next time you log in.

### Helpful 1-Click Presets
- **Executive View:** Cleans up the clutter and shows only high-level graphs and big-picture profit/cash numbers.
- **Operations View:** Highlights action buttons and overdue bills so you can get daily admin done fast.
- **Minimal View:** Displays only your essential cash and profit metrics.
- **All Active:** Turns on everything for a complete financial overview.

---

## 3. Managing Multiple Companies with One Login

If you own or manage more than one business, you no longer need multiple accounts or passwords:

- **Switching Between Companies:**
  Look at the top right of your screen next to your currency. Click your company name to see all your businesses. Click any company to instantly switch to its dashboard and finances.
- **Adding a New Company:**
  Need to set up a new subsidiary, side-business, or consulting practice? Open the company menu, click **+ Add Company**, enter the business name and currency, and Blynt sets up a clean, ready-to-use workspace immediately.

---

## 4. Managing Bank Accounts

Keep your bank setup organized as your business expands:

- **Add a Bank Account:** Go to **Banking & Accounts**, click **Add Bank Account**, and fill in your account nickname (e.g. *Barclays Current Account*), account number, and sort code. Blynt automatically links it to your bookkeeping records.
- **Remove Old Accounts:** If you close an old account or switch banks, you can remove it with one click while keeping your historical reports intact.

---

## 5. Automatic Vendor Identification & Smart Bookkeeping

Bookkeeping usually takes hours of typing merchant names and guessing category codes. Blynt does this for you automatically:

1. **Automatic Vendor Matching:** When a transaction like *"Adobe Creative Cloud Team License"* appears, Blynt recognizes the company as **Adobe**, links it to your supplier address book, and marks it with a green **AI Identified** badge.
2. **Category Suggestions:** The system checks whether this is software, rent, office supplies, or sales revenue and selects the proper category automatically.
3. **One-Click Confirmation:** All you have to do is glance at the suggested category and click **Confirm**. Your reports are instantly updated.

---

## 6. Your Built-in AI Financial Assistant

Throughout the app, you have access to a friendly AI assistant designed to take natural language instructions:

### Draft Customer Invoices in Plain English
- Instead of filling out complex forms, click **AI Draft Invoice** (or the **AI Assistant** button at the top of your screen).
- Type in plain English:  
  *“Invoice Acme Corp £1,500 for 3 days of marketing consulting”*
- The assistant instantly builds a complete, professional invoice with customer details, description, quantities, and VAT calculated. Click **Post Invoice** to send it.

### Draft Journal Entries Easily
- For accountants and bookkeepers: type *“Accrue £1,200 audit fee for March”* or *“Record £500 monthly equipment depreciation”*.
- The assistant creates balanced debit and credit entries with double-entry accounting rules built in.

### Instant Reports & Tax Commentary
- Open your Profit & Loss or VAT reports and click **AI Commentary**. The assistant explains in plain language why your profit changed, what expenses grew, and what your estimated tax liability looks like.

---

## 7. Fresh Start: Ready for Real Business Data

All test and sample data (fictional invoices, demo bills, and sample transactions) has been cleared from your workspace.

- **What was cleared:** All test invoices, sample bank transactions, demo contacts, and practice receipts.
- **What was kept:** Your user login, your company profiles, and your standard accounting categories.
- **Next steps:** You can now connect your live bank feed, import real statements, or create your first real customer invoice with total peace of mind.
`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blynt — Business User Guide & Feature Manual</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      line-height: 1.6;
      font-size: 10.5pt;
      margin: 0;
      padding: 0;
      background: #FFFFFF;
    }
    .header-banner {
      background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
      color: #FFFFFF;
      padding: 26px 30px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title {
      font-size: 21pt;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 6px 0;
      color: #FFFFFF;
    }
    .header-subtitle {
      font-size: 11pt;
      color: #93C5FD;
      margin: 0;
      font-weight: 500;
    }
    .badge-user-guide {
      display: inline-block;
      background: #FF705B;
      color: #FFFFFF;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #0F172A;
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 6px;
      margin-top: 26px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11.5pt;
      font-weight: 700;
      color: #1E3A8A;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 10px 0;
      color: #334155;
    }
    ul, ol {
      margin: 0 0 14px 0;
      padding-left: 20px;
      color: #334155;
    }
    li {
      margin-bottom: 5px;
    }
    .feature-card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 14px 18px;
      margin: 14px 0;
      page-break-inside: avoid;
    }
    .feature-card-highlight {
      background-color: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 10px;
      padding: 14px 18px;
      margin: 14px 0;
      page-break-inside: avoid;
    }
    .card-title {
      font-weight: 800;
      font-size: 11pt;
      color: #0F172A;
      margin-bottom: 6px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 8pt;
      font-weight: 700;
    }
    .badge-coral {
      background-color: #FFF1F0;
      color: #E11D48;
      border: 1px solid #FECDD3;
    }
    .badge-green {
      background-color: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
    }
    .badge-blue {
      background-color: #EFF6FF;
      color: #1E40AF;
      border: 1px solid #BFDBFE;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      padding: 9px 12px;
      text-align: left;
      border: 1px solid #E2E8F0;
    }
    th {
      background-color: #F1F5F9;
      color: #0F172A;
      font-weight: 700;
    }
    tr:nth-child(even) td {
      background-color: #F8FAFC;
    }
    .prompt-example {
      background-color: #EFF6FF;
      border-left: 4px solid #2563EB;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #1E3A8A;
      margin: 8px 0;
    }
    .page-break {
      page-break-before: always;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #64748B;
    }
  </style>
</head>
<body>

  <!-- Banner -->
  <div class="header-banner">
    <div>
      <div class="header-title">Blynt — Business User Guide</div>
      <div class="header-subtitle">A Plain-English Manual for Business Owners, Managers & Bookkeepers</div>
    </div>
    <div style="text-align: right;">
      <span class="badge-user-guide">User Manual</span>
      <div style="color: #93C5FD; font-size: 8.5pt; margin-top: 6px;">October 2026 Edition</div>
    </div>
  </div>

  <p style="font-size: 11pt; color: #1E293B; font-weight: 500;">
    Welcome to <strong>Blynt</strong>. This guide is written in clear, non-technical business language to help you navigate your finances, automate daily admin, and save valuable time every month.
  </p>

  <!-- Section 1 -->
  <h2>1. Understanding Your Money: Transactions vs. Reconciliation</h2>
  <div class="feature-card">
    <div class="card-title">What is the difference between Transactions and Bank Reconciliation?</div>
    <p>
      <strong>• Bank Transactions (Your Daily Money In & Out):</strong><br/>
      This is the activity feed from your bank accounts. As customer deposits arrive and bills are paid, each item appears here. Your goal is simply to review the description, verify the suggested category (e.g., <em>Software</em>, <em>Office Rent</em>, <em>Consulting Revenue</em>), and click <strong>Confirm</strong>.
    </p>
    <p style="margin-bottom: 0;">
      <strong>• Bank Reconciliation (Your Periodic Reality Check):</strong><br/>
      At the end of the month, reconciliation checks that your internal books match your official bank statement balance down to the exact penny. It ensures no transactions were missed, duplicated, or entered with the wrong amount, giving you audit-ready confidence.
    </p>
  </div>

  <!-- Section 2 -->
  <h2>2. Personalizing Your Dashboard (Tick & Untick)</h2>
  <p>
    You can customize your home screen so that it only shows the information relevant to you.
  </p>
  <ul>
    <li><strong>How to edit:</strong> Click the <strong>Customize Dashboard</strong> button right below your morning greeting on the home screen.</li>
    <li><strong>Tick or untick widgets:</strong> Choose which of the 12 cards you want visible:
      <ul>
        <li><strong>Quick Actions:</strong> Shortcuts to create an invoice, record a payment, or add an expense.</li>
        <li><strong>KPI Numbers:</strong> Cash Balance, Income, Expenses, Net Profit, Unpaid Invoices, and Bills Due.</li>
        <li><strong>Charts:</strong> 12-Month Cash Flow trend line and Income vs. Expenses breakdown.</li>
        <li><strong>Data Tables:</strong> Recent transactions, invoices awaiting payment, and bills coming due.</li>
      </ul>
    </li>
    <li><strong>Instant Presets:</strong> Choose <em>Executive View</em> for a clean high-level summary, <em>Operations</em> for fast daily admin, or <em>Minimal</em> for a compact view.</li>
    <li>Your selections are automatically saved and remembered every time you log in.</li>
  </ul>

  <div class="page-break"></div>

  <!-- Section 3 -->
  <h2>3. Managing Multiple Companies with One Login</h2>
  <p>
    If you operate several businesses or legal entities, you can manage them all under a single login:
  </p>
  <div class="feature-card">
    <div class="card-title">Seamless Company Switching</div>
    <ul>
      <li><strong>Switch Companies in 1 Click:</strong> Look at the top navigation bar. Click your current company name (e.g., <em>Test</em> or <em>Demo Consulting</em>) to view all your businesses. Click any company to instantly open its accounts.</li>
      <li><strong>Add a New Business:</strong> Click <strong>+ Add Company</strong> in the dropdown menu. Enter the new business name, legal registration, and base currency. Blynt automatically provisions a fresh workspace with standard accounting categories ready to go.</li>
    </ul>
  </div>

  <!-- Section 4 -->
  <h2>4. Adding & Removing Bank Accounts</h2>
  <p>
    As your business opens new accounts or updates banking arrangements, you can manage them directly:
  </p>
  <ul>
    <li><strong>Adding an Account:</strong> Navigate to <strong>Banking & Accounts</strong>, click <strong>Add Bank Account</strong>, and provide your account name (e.g. <em>Barclays Business Current</em>), account number, sort code, and starting balance. Blynt links it directly to your cash ledger.</li>
    <li><strong>Removing an Account:</strong> If you close an account, click the options menu on the account card and select <strong>Delete Account</strong>. Safety protections prevent accidental deletion if active unreconciled records exist.</li>
  </ul>

  <!-- Section 5 -->
  <h2>5. Smart Vendor Identification & Automated Bookkeeping</h2>
  <p>
    Traditional bookkeeping requires manually reading each transaction line and typing supplier names. Blynt automates this process:
  </p>
  <div class="feature-card-highlight">
    <div class="card-title">How Automatic Identification Works</div>
    <ul>
      <li><strong>Recognizing Payees:</strong> When a transaction like <em>"Adobe Creative Cloud Team License"</em> or <em>"Google Workspace 15 Users"</em> appears, Blynt recognizes the vendor as <strong>Adobe</strong> or <strong>Google</strong> and attaches an <span class="badge badge-green">✨ AI Identified</span> badge.</li>
      <li><strong>Category Predictions (95%+ Accuracy):</strong> Historical patterns automatically categorize recurring items under the right accounting code (e.g., <em>Software & Subscriptions</em>).</li>
      <li><strong>One-Click Confirmation:</strong> Simply review the row and click <strong>Confirm</strong>. Your General Ledger and financial reports are updated immediately.</li>
    </ul>
  </div>

  <!-- Section 6 -->
  <h2>6. Your Built-in AI Financial Assistant</h2>
  <p>
    Save time drafting paperwork by using natural English prompts:
  </p>
  <table>
    <thead>
      <tr>
        <th>Task</th>
        <th>How to Use It</th>
        <th>Example Prompt</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Draft Customer Invoice</strong></td>
        <td>Click <strong>AI Draft Invoice</strong> in Sales. Type who to bill and how much.</td>
        <td><div class="prompt-example">“Invoice Bright Ideas £1,250 for website revamp due in 14 days”</div></td>
      </tr>
      <tr>
        <td><strong>Draft Journal Adjustment</strong></td>
        <td>Click <strong>AI Draft Journal</strong> in Accounting for accruals or prepayments.</td>
        <td><div class="prompt-example">“Accrue £1,200 audit fee for March”</div></td>
      </tr>
      <tr>
        <td><strong>Financial & Tax Insights</strong></td>
        <td>Click <strong>AI Commentary</strong> on Profit & Loss or VAT reports.</td>
        <td><div class="prompt-example">Produces executive summary of your income, profit margins, and tax due.</div></td>
      </tr>
      <tr>
        <td><strong>Universal Assistant</strong></td>
        <td>Click <strong>✨ AI Assistant</strong> in the top header on any page.</td>
        <td>Instant natural-language drafting across Sales, Purchases, Banking, and Reports.</td>
      </tr>
    </tbody>
  </table>

  <!-- Section 7 -->
  <h2>7. Clean Slate: Ready for Your Live Financial Data</h2>
  <div class="feature-card">
    <div class="card-title">Sample Data Cleared & Verified</div>
    <p>
      All demo practice transactions (test invoices, practice bills, and demo statement lines) have been cleanly wiped from the system.
    </p>
    <p style="margin-bottom: 0;">
      Your workspace is <strong>100% clean and ready for real data</strong>. You can now import your live bank statements, create genuine customer invoices, and add your team members with complete confidence.
    </p>
  </div>

  <div class="footer">
    <div>Blynt Business Finance — Official Non-Technical User Manual</div>
    <div>Page 2 of 2 • Ready for Business Operations</div>
  </div>

</body>
</html>`;

const mdFile = path.resolve('d:/Project/F!/Blynt_Business_User_Guide.md');
const pdfFile = path.resolve('d:/Project/F!/Blynt_Business_User_Guide.pdf');
const brainPdf = 'C:\\Users\\Sujampathi\\.gemini\\antigravity-ide\\brain\\a2602a53-bad1-434b-8a06-3e9ae591b2bc\\Blynt_Business_User_Guide.pdf';
const tempHtml = path.resolve('d:/Project/F!/scripts/temp_business_guide.html');

fs.writeFileSync(mdFile, mdContent, 'utf-8');
console.log('Markdown written to:', mdFile);

fs.writeFileSync(tempHtml, htmlContent, 'utf-8');
console.log('HTML written to:', tempHtml);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfFile}" "${tempHtml}"`;

console.log('Generating Business User Guide PDF...');
execSync(cmd);
console.log('PDF generated at:', pdfFile);

if (fs.existsSync(pdfFile)) {
  fs.copyFileSync(pdfFile, brainPdf);
  console.log('Copied PDF to brain artifacts:', brainPdf);
}

fs.unlinkSync(tempHtml);
console.log('Done!');
