# Defect Log

Use GitHub Issues as the primary defect tracker. This file describes the minimum information required; it is not a claim that the following defects have been observed.

## Required fields
- Defect ID / GitHub issue:
- Summary:
- Severity and priority:
- Affected version/commit:
- Environment:
- Preconditions and reproduction steps:
- Expected result:
- Actual result:
- Logs/screenshots (redacted):
- Tenant/accounting/security impact:
- Root cause:
- Fix and test references:
- Regression risk:
- Documentation updated:
- Verification commit and date:
- Closure owner:

## Severity guidance
- **Critical:** likely cross-tenant exposure, material financial integrity loss, unauthorised posting, or active compromise.
- **High:** significant access-control weakness, incorrect report totals, data loss, or a core workflow unavailable without safe workaround.
- **Medium:** material but bounded functionality or usability issue with a workaround.
- **Low:** minor presentation or non-critical issue.

Severity should reflect impact and exploitability, not implementation effort. Escalate accounting and security defects for explicit review. Keep this page free of production personal data and secrets.
