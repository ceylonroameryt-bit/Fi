# Blynt – rules for every change
## Non-negotiable
1. Every ledger change goes through the posting engine (Phase 9). No module writes ledger rows directly.
2. Money is fixed-point decimal, never float. One shared rounding function.
3. Posted records are immutable; corrections are reversals or credit notes.
4. Every query is scoped to the organisation (tenant isolation in the data layer).
5. AI only creates DRAFTS. Totals, VAT and balances are calculated by code, never by the model. A user with permission approves before anything posts.
6. Fields missing from a document are null, never guessed. No default tax codes.
7. Follow the existing stack, folder structure, naming and test conventions.
## Every change must
- Include tests; anything that moves money includes a "trial balance still balances" check.
- Pass the full test suite before it is finished.
- Be committed separately per stage, on a branch named feature/<stage>.
