---
name: weekly-testing-health-scorecard
description: Produce and maintain a weekly engineering testing health report with coverage snapshot, quality metrics, and action items. Use when the user asks for weekly test health review, scorecard updates, or engineering quality tracking.
---

# Weekly Testing Health Scorecard

## Purpose

Maintain a repeatable weekly quality pulse for engineering and testing.

## Canonical Document

- Update: `planning/YYYY-MM-DD-testing-health.md`

## Weekly Sections

1. **Current test snapshot**
- Total suites/tests (as of run date)
- Pass/fail status

2. **Coverage highlights and gaps**
- Highest-risk covered areas
- Critical untested or weakly-tested modules

3. **Engineering metrics pulse**
- DORA (lead time, failure rate, recovery trend notes)
- SPACE/Flow lightweight observations

4. **Principles compliance**
- DRY/SOLID or architecture drift signals
- Contract-first and server-authoritative compliance checks

5. **Actions for next week**
- 3-5 concrete backlog items with owners or scope labels

## Data Collection Checklist

- Run tests and lint for current snapshot.
- Gather any file-level coverage for critical game logic.
- Review recent high-impact changes for risk exposure.

## Output Style

- Keep concise and operational.
- Separate facts (measured) from assumptions (inferred).
- End with a short "overall health" assessment: green / yellow / red.
