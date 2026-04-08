---
name: todo-burndown-autopilot
description: Execute TODO backlog items autonomously in prioritized batches with verification after each batch. Use when the user asks for full agency to continue looping through TODOs until completion.
---

# TODO Burndown Autopilot

## Purpose

Close backlog items quickly without constant user prompting.

## When to Use

- "Take full agency"
- "Continue in a loop through all TODOs"
- "Just keep going until done"

## Workflow

1. **Read backlog source**
- Parse `TODOS.md` and identify unchecked items.
- Group items by risk and implementation effort.

2. **Prioritize**
- Start with high-value, low-risk items.
- Defer major architectural rewrites unless explicitly requested.

3. **Implement in batches**
- Make a coherent batch of changes.
- Keep diffs focused and reversible.

4. **Verify each batch**
- Run relevant tests and lint.
- Fix introduced errors before moving to next batch.

5. **Update backlog with evidence**
- Mark items done only when verified.
- Include file references for completion notes.

6. **Loop**
- Repeat until no unchecked TODOs remain or an external blocker appears.

## Guardrails

- Do not revert unrelated user changes.
- Avoid destructive git operations.
- Keep the user informed with concise progress updates.

## Completion Criteria

- `TODOS.md` has no unchecked items for targeted section(s).
- Test/lint status is green (or known pre-existing warnings only).
- Clear summary of what changed and what remains (if anything).
