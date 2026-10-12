# 09. UI/UX Design System Specification

**Design Philosophy:** Institutional Accounting Clarity & Zero Cognitive Fatigue  
**Frontend Framework:** Next.js 15 (React 19, CSS Variables, App Router)  
**Primary Brand Colors:** Deep UK Banking Navy (`#162D5F`) & Warm Modern Coral (`#FF7F6C`)  

---

## 1. Ergonomic Vision & Philosophy (Non-Technical Explanation)

Bookkeepers and accountants spend 8 to 10 hours a day staring at financial tables. Traditional software often causes eyestrain with cluttered interfaces, tiny text, and unpredictable layout shifts.

blynt’s interface is designed around three ergonomic principles:
1. **Vertical Alignment of Pennies:** In standard fonts (like Times New Roman or Calibri), the digit `1` is narrower than the digit `8`. If you list numbers vertically, the decimal points wobble, forcing the human eye to work harder to verify columns. blynt forces **Tabular Figures** (`tabular-nums`), so every digit occupies the exact same horizontal width. Decimal points align in a straight vertical line.
2. **Instant Visual Feedback:** While entering debit and credit rows, a floating tally bar at the bottom of the screen updates in real time. If the difference is even one penny off, a red warning badge indicates the exact discrepancy. The moment debits equal credits, the badge turns emerald green and enables the "Validate" button.
3. **Calm, High-Contrast Palette:** Built with deep navy backgrounds and soft slate card surfaces, reducing blue-light fatigue during month-end closes.

---

## 2. Color System & Semantic Tokens

| Token Name | Hex Code | HSL Value | Application & Meaning |
| :--- | :---: | :---: | :--- |
| `brand-navy` | `#162D5F` | `221, 64%, 23%` | Primary navigation headers, table header banners, master brand identity. |
| `brand-coral` | `#FF7F6C` | `8, 100%, 71%` | Call-to-action buttons, active tab highlights, primary brand accent. |
| `bg-canvas` | `#090D16` / `#F8FAFC` | Dark / Light | Global application background canvas. |
| `card-surface`| `#111827` / `#FFFFFF` | Dark / Light | Elevated data cards, slide-over panels, journal data tables. |
| `border-subtle`|`#1F2937` / `#E2E8F0` | Dark / Light | Table borders, input dividing lines, card outlines. |
| `status-balanced`|`#10B981` | `160, 84%, 39%` | Emerald green: balanced journals, active status, validated checks. |
| `status-error`| `#EF4444` | `0, 84%, 60%` | Red: journal imbalances, hard-locked badges, validation rejections. |
| `status-warning`|`#F59E0B` | `38, 92%, 50%` | Amber: soft-locked periods, draft journals, pending approvals. |

---

## 3. Financial Data Formatting Standards

1. **Right-Alignment of Currency:** All numeric financial amounts must be strictly aligned to the right:
   ```css
   .currency-cell {
     text-align: right;
     font-variant-numeric: tabular-nums;
     font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
   }
   ```
2. **Negative Value Representation:** Negative values are displayed in red text enclosed in parentheses:
   * Positive: `£1,250.00`
   * Negative: `(£1,250.00)`
3. **Zero Values:** Explicitly displayed as `£0.00` (or `—` in dense summary tables).

---

## 4. Key Screen Blueprints

### 4.1 Master Journal Entry Screen (`/accounting/journals/new`)
* **Header Bar:** Journal Date picker, Auto-generated Sequence preview (`JE-2026-XXXXXX`), General narrative memo input.
* **Line Item Grid:**
  * Account selector with instant nominal search (e.g., typing "1100" or "Debtors" filters the list).
  * Optional Subledger contact tag (searchable customer/supplier name).
  * Line narrative memo.
  * Debit input field (`NUMERIC(19,4)` formatted).
  * Credit input field (`NUMERIC(19,4)` formatted).
  * Delete row button (`Trash` icon).
  * "+ Add Line Item" button.
* **Sticky Tally Footer:**
  * Left: Total Debits `£X,XXX.XXXX`
  * Center: Total Credits `£X,XXX.XXXX`
  * Right: Live Difference Badge (`£0.0000` = Green, `> £0` = Red)
  * Action: "Validate & Post Journal" button (disabled until difference is 0).

### 4.2 Customer Statement Screen (`/sales/customers/[id]/statement`)
* **Customer Profile Header:** Registered legal name, UK VAT number, company number, payment terms (e.g., "Net 30 Days").
* **Date Range Selector:** Quick filters ("This Financial Year", "Last 30 Days", "All Time").
* **Chronological Statement Table:**
  * Date | Reference # | Description | Debit (Invoices) | Credit (Payments) | Running Balance
* **Statement Summary Card:**
  * Total Invoiced (YTD) | Total Paid | Current Balance Due | Overdue Balance (> 30 Days).
* **Export Action:** "Download PDF Statement" & "Email Statement to Customer".
