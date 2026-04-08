---
name: qa-fix-verify-loop
description: Convert QA findings into implemented fixes and validated rechecks using browser automation, focused code edits, and regression verification. Use when QA report exists and the user wants fixes, not just bug listing.
---

# QA Fix Verify Loop

## Purpose

Close the loop from bug report to verified fix.

## When to Use

- "/qa then fix"
- "Fix these QA findings"
- "Verify this issue is resolved"

## Workflow

1. **Parse QA findings**
- Enumerate issues by severity and impacted route/component.

2. **Map issue -> code**
- Identify exact files for each finding.
- Prefer minimal targeted edits.

3. **Implement fixes**
- Address root cause with user-visible behavior improvements.
- For UX validation issues, ensure explicit inline/toast feedback.
- For accessibility issues, ensure hidden content is not exposed.

4. **Run local verification**
- Lint and relevant tests.
- Reproduce previous failure path and confirm expected behavior.

5. **Browser recheck**
- Re-run affected user flows via browser automation.
- Capture screenshots/evidence for previously failing steps.

6. **Report delta**
- Mark each issue as fixed/partially fixed/open.
- Include remaining risk and next actions.

## Output Format

- Fixed issues list with file paths.
- Verification commands run.
- Browser evidence summary.
