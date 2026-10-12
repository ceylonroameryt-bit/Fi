# Blynt — Visual Diagrams Only (Non-IT Business & Client Guide)

All Use Cases and Test Cases presented purely as visual diagrams with embedded business rules, steps, and pass/fail conditions.

---

## 1. Master System Overview Diagram

```mermaid
flowchart TB
    subgraph Actors["👥 PEOPLE (Non-IT Roles)"]
        Owner["👔 Business Owner"]
        Accountant["📊 Accountant / Bookkeeper"]
        Client["🛒 External Client / Payer"]
        Auditor["🔍 Tax / Statutory Auditor"]
    end

    subgraph BusinessSide["🏢 BUSINESS SIDE WORKFLOWS"]
        direction TB
        B1["1. Create 20% VAT Invoices"]
        B2["2. Scan Receipts with AI"]
        B3["3. Lock Year-End Books"]
        B4["4. Safe Void & Error Correction"]
    end

    subgraph ClientSide["🌐 CLIENT SIDE WORKFLOWS"]
        direction TB
        C1["5. View Invoice (No Login)"]
        C2["6. Pay Online (Card / Apple Pay)"]
        C3["7. Download A4 PDF Statement"]
    end

    subgraph CoreSafety["🛡️ BUILT-IN SAFETY SHIELDS"]
        direction TB
        S1["⚖️ Books Always Balance"]
        S2["🔒 No Editing Closed Tax Years"]
        S3["🚫 Double-Click Payment Shield"]
    end

    Owner --> B1
    Owner --> B4
    Accountant --> B2
    Accountant --> B3
    Client --> C1
    Client --> C2
    Client --> C3
    Auditor --> B4
    Auditor --> C3

    B1 -.protected by.-> S1
    B3 -.enforces.-> S2
    C2 -.protected by.-> S3
```

---

## 2. Business Use Case 1: Issue & Send Invoice (Sales Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Owner as 👔 Business Owner
    participant App as 🖥️ Blynt Screen
    participant Engine as ⚙️ Math & VAT Engine
    actor Client as 🛒 Customer

    Owner->>App: 1. Click '+ New Invoice' & Pick Customer 'Acme UK Ltd'
    Owner->>App: 2. Enter Line Item: 'Consulting £1,000' + 20% VAT
    App->>Engine: 3. Compute tax automatically
    Engine-->>App: 4. Shows: Subtotal £1,000 + VAT £200 = Total £1,200
    Owner->>App: 5. Click 'Approve & Issue'
    Engine->>Engine: 6. Update Acme UK Ltd balance to £1,200
    App->>Client: 7. Deliver branded email with view link & PDF
    App-->>Owner: 8. Badge turns 'Awaiting Payment'
```

---

## 3. Client Use Case 2: Client Views & Pays Online (Client Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Client as 🛒 External Customer
    participant Link as 🌐 Web Invoice View
    participant Card as 💳 Secure Card Checkout
    participant Blynt as 🏦 Blynt Accounting
    actor Owner as 👔 Business Owner

    Client->>Link: 1. Click email link (No password needed)
    Link-->>Client: 2. Shows branded invoice, £1,200 total & 'Pay Now'
    Client->>Card: 3. Click 'Pay Now' & enter card details
    Card->>Card: 4. Process transaction securely
    Card-->>Link: 5. Green checkmark: 'Payment Successful!'
    Link->>Blynt: 6. Flip invoice status to 'PAID'
    Blynt->>Blynt: 7. Record cash received in Bank Account
    Link-->>Client: 8. Email payment receipt PDF
    Blynt-->>Owner: 9. Alert: 'Invoice INV-1001 paid by Acme UK Ltd'
```

---

## 4. Business Use Case 3: Scan Receipts with AI (Expense Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 📱 Bookkeeper / Staff
    participant App as 🖥️ Expense Screen
    participant AI as 🤖 Document AI
    participant Ledger as 📚 Accounting Records

    User->>App: 1. Drag receipt photo into upload box
    App->>AI: 2. Scan photo for vendor, date & amounts
    AI->>AI: 3. Check math: Net £10.00 + VAT £2.00 == Total £12.00
    AI-->>App: 4. Auto-fill: 'Costa Coffee', '£12.00', 'Travel & Meals'
    User->>App: 5. Verify fields on screen & click 'Save Expense'
    App->>Ledger: 6. Record expense & permanently attach photo
    App-->>User: 7. Green message: 'Expense saved for tax file'
```

---

## 5. Client Use Case 4: Client Self-Service Statement & A4 PDF

```mermaid
sequenceDiagram
    autonumber
    actor Client as 🛒 Customer / Accountant
    participant Portal as 🌐 Client Portal
    participant PDF as 📄 PDF Generator

    Client->>Portal: 1. Open statement link from email
    Portal-->>Client: 2. Shows all past invoices, payments & balance £0.00
    Client->>Portal: 3. Click 'Download Statement (PDF)'
    Portal->>PDF: 4. Generate A4 document with running balances
    PDF-->>Client: 5. Downloads clean, printable 'Statement.pdf'
    Client->>Portal: 6. Click 'Download PDF' on specific invoice
    PDF-->>Client: 7. Downloads official 'Invoice-1001.pdf'
```

---

## 6. Business Use Case 5: Lock Financial Year-End Books

```mermaid
sequenceDiagram
    autonumber
    actor Acc as 📊 Certified Accountant
    participant App as 🖥️ Financial Years Screen
    participant Shield as 🔒 Year-End Lock Shield
    actor Staff as 👔 General Staff Member

    Acc->>App: 1. Reconcile books & file annual taxes with HMRC
    Acc->>App: 2. Click 'Lock Financial Year 2024'
    App->>Shield: 3. Freeze all transactions dated on or before 31 Dec 2024
    Note over Staff,Shield: Weeks later, staff tries editing 2024
    Staff->>App: 4. Enter invoice dated 15 Nov 2024 & click 'Approve'
    App->>Shield: 5. Check if date is inside locked year
    Shield-->>App: 6. Date is LOCKED!
    App-->>Staff: 7. Error: 'Cannot backdate into closed financial year'
```

---

## 7. Business Use Case 6: Safe Error Correction (Void Invoice)

```mermaid
sequenceDiagram
    autonumber
    actor Owner as 👔 Business Owner
    participant App as 🖥️ Invoice Management
    participant Books as ⚖️ Double-Entry Ledger
    actor Auditor as 🔍 Tax Auditor

    Owner->>App: 1. Open Invoice #1004 (issued in error)
    Owner->>App: 2. Click 'Options' ➔ 'Void Invoice'
    App-->>Owner: 3. Prompt: 'Please type reason for cancellation'
    Owner->>App: 4. Type: 'Customer cancelled project' & confirm
    App->>Books: 5. Create balancing reversal entry
    Books->>Books: 6. Customer balance drops back to £0.00
    App-->>Owner: 7. Status badge turns grey 'VOID'
    Note over Auditor,App: Months later, tax inspection takes place
    Auditor->>App: 8. Inspect audit trail for Invoice #1004
    App-->>Auditor: 9. Full history shown: who voided, when & why
```

---

## 8. Test Case: 20% VAT Math & Customer Balance (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 1: Create £1,000 Invoice]) --> Step1[Enter Item: £1,000 + 20% VAT]
    Step1 --> CheckMath{Did system calculate Subtotal £1,000 + VAT £200 = Total £1,200?}
    CheckMath -- NO --> FailMath[❌ FAIL: Math Calculation Error]
    CheckMath -- YES --> Step2[Click 'Approve & Issue']
    Step2 --> CheckStatus{Status = 'Awaiting Payment' AND Customer Balance = £1,200?}
    CheckStatus -- YES --> Pass[✅ PASS: Sales & VAT Test Succeeded]
    CheckStatus -- NO --> FailBalance[❌ FAIL: Status stuck or balance wrong]
```

---

## 9. Test Case: Client Online Card Payment (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 2: Client Online Payment]) --> Step1[Client clicks email link: invoice opens without login]
    Step1 --> Step2[Client clicks 'Pay Now' & enters test card]
    Step2 --> Step3[Click 'Pay £1,200' button]
    Step3 --> CheckButton{Does button instantly disable & show spinner?}
    CheckButton -- NO --> FailDouble[❌ FAIL: Button allowed double-clicks]
    CheckButton -- YES --> CheckPay{Did payment succeed?}
    CheckPay -- YES --> Step4[Invoice flips to 'PAID' + Receipt emailed]
    Step4 --> PassPay[✅ PASS: Online Payment Succeeded]
    CheckPay -- Card Declined --> Handled[⚠️ PASS (Handled): Friendly 'Card declined' error]
```

---

## 10. Test Case: AI Receipt Scanner Guardrail (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 3: AI Receipt Upload]) --> Step1[Drag & drop receipt photo into box]
    Step1 --> Step2[Wait 2-4 seconds for AI scan]
    Step2 --> CheckRead{Did AI extract correct Vendor, Date & Total?}
    CheckRead -- NO / Hallucinated --> FailAI[❌ FAIL: Incorrect data extracted]
    CheckRead -- YES --> Step3[Review extracted amounts & select category]
    Step3 --> Step4[Click 'Save Expense']
    Step4 --> CheckSaved{Expense saved AND receipt photo permanently attached?}
    CheckSaved -- YES --> PassAI[✅ PASS: AI Extraction Verified]
    CheckSaved -- NO --> FailSave[❌ FAIL: Receipt image not saved]
```

---

## 11. Test Case: "Never Unbalanced" Safety Ledger Rule (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 4: Unbalanced Journal Entry]) --> Step1[Line 1: Debit Bank Account £500]
    Step1 --> Step2[Line 2: Credit Sales Income £400 (leaving £100 gap)]
    Step2 --> Step3[Try clicking 'Post to Ledger']
    Step3 --> CheckBlock{Does system block the save?}
    CheckBlock -- YES --> Step4[Red banner: 'Debits and Credits must balance']
    Step4 --> PassBalance[✅ PASS: System blocked unbalanced books]
    CheckBlock -- NO --> FailBalance[❌ FAIL CRITICAL: Corrupt unbalanced books saved!]
```

---

## 12. Test Case: Locked Year-End Backdating Block (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 5: Financial Year 2024 is Locked]) --> Step1[Create invoice dated 15 Nov 2024]
    Step1 --> Step2[Fill details and click 'Approve']
    Step2 --> CheckLock{Does system reject the transaction?}
    CheckLock -- YES --> Step3[Warning: 'Period closed. Cannot backdate into 2024.']
    Step3 --> PassLock[✅ PASS: Historical tax records protected]
    CheckLock -- NO --> FailLock[❌ FAIL CRITICAL: Altered closed tax records!]
```

---

## 13. Test Case: Client-Side Instant Form Validation (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 6: Form Validation on Screen]) --> Step1[Type invalid email: 'john@' missing domain]
    Step1 --> Step2[Tab to next box without submitting]
    Step2 --> CheckRed{Field immediately turns red with helpful tip?}
    CheckRed -- NO --> FailVal[❌ FAIL: No instant visual feedback]
    CheckRed -- YES --> Step3[Notice: Form did NOT refresh and nothing was erased]
    Step3 --> Step4[Correct email to 'john@acme.co.uk']
    Step4 --> CheckClear{Red outline disappears?}
    CheckClear -- YES --> PassVal[✅ PASS: Real-time validation verified]
    CheckClear -- NO --> FailVal2[❌ FAIL: Error stuck on screen]
```

---

## 14. Test Case: Mobile Phone Layout & Thumb Test (Pass / Fail)

```mermaid
flowchart TD
    Start([Test 7: Mobile Device View]) --> Step1[Open invoice on iPhone / Android browser]
    Step1 --> CheckMenu{Menu collapsed into clean '☰' icon?}
    CheckMenu -- NO --> FailMob[❌ FAIL: Broken desktop layout on phone]
    CheckMenu -- YES --> Step2[Check invoice summary table]
    Step2 --> CheckScroll{Cards stack vertically with NO horizontal scroll?}
    CheckScroll -- NO --> FailMob2[❌ FAIL: Horizontal scroll needed to see prices]
    CheckScroll -- YES --> Step3[Tap 'Pay Now' or 'Download' button with thumb]
    Step3 --> CheckTouch{Button large enough and easy to tap?}
    CheckTouch -- YES --> PassMob[✅ PASS: 100% Mobile Responsive]
    CheckTouch -- NO --> FailMob3[❌ FAIL: Buttons too small for touch]
```
