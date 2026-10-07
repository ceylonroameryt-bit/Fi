# Database Schema: Contacts & Subledger

## Entities

### `contacts`
Stores core business contacts (Customers, Suppliers, or Both).

| Column | Type | Nullable | Constraints & Description |
|---|---|---|---|
| `id` | TEXT | No | Primary Key (`cuid`) |
| `organization_id` | TEXT | No | FK -> `organizations(id)` |
| `type` | ContactType | No | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| `status` | ContactStatus | No | `ACTIVE`, `ARCHIVED` (default `ACTIVE`) |
| `name` | TEXT | No | Trading or display name |
| `company_name` | TEXT | Yes | Registered company name |
| `company_number` | TEXT | Yes | Companies House registration number |
| `vat_number` | TEXT | Yes | VAT identifier |
| `tax_number` | TEXT | Yes | Generic international tax ID |
| `email` | TEXT | Yes | Primary email |
| `phone` | TEXT | Yes | Telephone number |
| `website` | TEXT | Yes | Website URL |
| `currency` | TEXT | Yes | Currency code (e.g., GBP) |
| `payment_terms_days` | INT | No | Default 30 |
| `credit_limit` | DECIMAL(15,2) | Yes | Credit limit |
| `address_line1` | TEXT | Yes | Billing address line 1 |
| `address_line2` | TEXT | Yes | Billing address line 2 |
| `city` | TEXT | Yes | Billing city |
| `state` | TEXT | Yes | Billing state/county |
| `postcode` | TEXT | Yes | Billing postal code |
| `country` | TEXT | Yes | Billing ISO country |
| `shipping_address_line1` | TEXT | Yes | Delivery address line 1 |
| `shipping_address_line2` | TEXT | Yes | Delivery address line 2 |
| `shipping_city` | TEXT | Yes | Delivery city |
| `shipping_state` | TEXT | Yes | Delivery state/county |
| `shipping_postcode` | TEXT | Yes | Delivery postal code |
| `shipping_country` | TEXT | Yes | Delivery ISO country |
| `receivable_account_id` | TEXT | Yes | Default AR control account |
| `payable_account_id` | TEXT | Yes | Default AP control account |
| `notes` | TEXT | Yes | Internal notes |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**Unique Constraints & Composite Keys**:
- `UNIQUE (organization_id, id)`: Enables composite tenant-safe references from child tables.

**Indexes**:
- `(organization_id, type)`
- `(organization_id, status)`
- `(organization_id, name)`
- `(organization_id, email)`
- `(organization_id, company_number)`
- `(organization_id, vat_number)`

---

### `contact_people`
Multiple contact persons associated with an individual contact.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | TEXT | No | Primary Key (`cuid`) |
| `organization_id` | TEXT | No | Organisation identifier |
| `contact_id` | TEXT | No | Contact identifier |
| `first_name` | TEXT | No | First name |
| `last_name` | TEXT | No | Last name |
| `job_title` | TEXT | Yes | Job title or role |
| `email` | TEXT | Yes | Email address |
| `phone` | TEXT | Yes | Direct phone |
| `mobile` | TEXT | Yes | Mobile phone |
| `is_primary` | BOOLEAN | No | Default `false` |
| `is_billing_contact` | BOOLEAN | No | Default `false` |
| `is_active` | BOOLEAN | No | Default `true` |
| `created_at` | TIMESTAMPTZ | No | Default `now()` |
| `updated_at` | TIMESTAMPTZ | No | Auto-updated |

**Foreign Keys**:
- `FOREIGN KEY (organization_id, contact_id) REFERENCES contacts(organization_id, id) ON DELETE CASCADE`

**Indexes**:
- `(organization_id, contact_id)`
- `(organization_id, email)`

---

### `journal_lines` Subledger Relation
Updated in Phase 3 to establish an enforced, tenant-safe foreign key:

- Added `FOREIGN KEY (organization_id, contact_id) REFERENCES contacts(organization_id, id) ON DELETE RESTRICT`
- Added index: `(organization_id, contact_id)`
