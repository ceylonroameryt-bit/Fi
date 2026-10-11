# Financial Years and Period Locking

## Purpose
Period controls prevent unauthorised changes to accounting data after review or close. The README describes OPEN, SOFT_LOCKED, and HARD_LOCKED states; confirm their exact implementation and transitions against current code.

## Required definitions
For each state specify:
- which roles may create, edit, validate, post, reverse, or delete drafts;
- whether posted journals can be reversed and in which period;
- whether a soft lock permits authorised exceptions and how those exceptions are recorded;
- whether a hard lock is absolute or has a separately governed emergency procedure;
- who can lock/unlock a period and whether a second-person approval is required.

## Date boundaries
Define financial-year and period start/end semantics, including time zones and whether end dates are inclusive. Periods must not overlap unintentionally. Boundary tests must cover the final day of one period and first day of the next.

## Transitions
Period state changes must be authorised, validated, transactional, and audited. Recheck period state during posting to avoid a time-of-check/time-of-use race where a period is locked after a journal was validated.

## Tests
- Valid and invalid date ranges.
- Overlapping periods.
- Journals on start/end boundaries.
- Posting into each period state.
- Lock/unlock role restrictions.
- Concurrent lock and posting attempts.
- Reversal of an entry from a locked period.
- Audit record for every state transition.
