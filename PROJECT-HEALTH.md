# Project Health

## Code Quality Audit (Testing + Principles)

### Principle Scorecard

| Principle | Grade | Issue | File | Test That Would Catch It |
|---|---|---|---|---|
| SRP | B | `RoomManager` handles room lifecycle, event routing, reconnect, persistence orchestration in one module | `server/rooms/RoomManager.js` | Contract tests per concern plus module-level integration tests |
| DRY | B | Repeated state payload shaping across game states and client screens | `server/games/*/GameState.js`, `client/src/screens/*` | Snapshot-like contract tests for payload shape helper outputs |
| Open/Closed | B- | `GameFactory.getConfig` has growing branch chain per new game | `server/games/GameFactory.js` | Config-contract tests per registered game keyset |
| Fail Fast | B | Env parsing exists but low direct test coverage on failure branches | `server/config/env.js` | Missing-env and malformed-env unit tests |
| YAGNI | A- | Lean pass removed runtime noise and some indirection; remaining abstractions mostly justified | `client/src/shared/*` | Existing contract tests guard removals |
| KISS | A- | RoomManager tests split by concern; payload helpers extracted | `server/rooms/RoomManager.*.test.js`, `server/test-helpers/` | Regression suite + `payloadShape` unit tests |
| Law of Demeter | B | Some deep nested payload handling and byPlayer slicing complexity | `RoomManager`, `UIManager` | Payload-schema assertions at boundary functions |
| Tell Don't Ask | B | Several flows inspect global state then branch externally | `client/src/shared/UIManager.js` | Behavior tests around screen transitions |
| Idempotency | B | Reconnect/rematch generally safe but sensitive to timer order | `RoomManager` | Repeat/reorder action sequence tests |
| Timeouts | B+ | Many timers covered in tests; no centralized timeout policy checks | multiple game states | Timer branch tests + repeated-run CI |

## Summary

- Strength: server game-rules and socket contract tests are robust and practical.
- Main risk: boundary modules (`analytics`, `env`, `GameFactory`, `Router`) remain under-tested relative to impact.
- Recommendation: execute Batch A from `TESTING-STRATEGY.md` this week before adding new gameplay features.

