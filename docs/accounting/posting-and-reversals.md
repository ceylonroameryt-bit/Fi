# Posting and Reversals

## Purpose
Posting makes a validated journal part of the authoritative accounting ledger. Reversal provides a traceable way to correct a posted entry without erasing the original financial history.

## Posting preconditions
Before posting, the server must re-check:
- caller authentication and permission;
- organisation membership and active organisation state;
- journal ownership and current state;
- journal balance and line validity;
- account ownership and eligibility;
- journal date and period status;
- uniqueness/idempotency conditions.

Do not rely on checks performed only when a draft was first saved or validated; relevant state can change before posting.

## Atomicity
A successful posting must commit all related state consistently. A failure must not leave a journal marked posted without its ledger effect, a ledger effect without the journal state, or missing required audit evidence. Use a database transaction and concurrency control appropriate to the actual schema.

## Duplicate requests and concurrency
Two requests attempting to post the same journal must not both create financial effects. Define the expected response to a retry, use state-transition guards and database constraints, and test concurrent requests. If idempotency keys are used, define their scope, retention, and behaviour for a reused key with different input.

## Reversal policy
Before implementing, decide and document:
- whether reversal creates a separate linked journal or changes a status on the original;
- whether the reversal date must be in an open period;
- how a locked original period affects reversal;
- whether partial reversals are supported;
- required permissions and any approval step;
- how reversal references appear in reports and exports.

The original posted entry should remain inspectable. Do not silently edit or delete posted financial facts.

## Evidence required
- Duplicate-post prevention under concurrent requests.
- Rollback after an injected failure.
- Reversal amounts and linkage are correct.
- Reports include both original and reversal according to selected date range.
- Audit trail identifies actor, time, original, reversal, and reason.
- Tenant and role restrictions apply to both original and reversal.
