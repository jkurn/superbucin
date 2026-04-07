#!/usr/bin/env bash
set -euo pipefail

# Save a lightweight session snapshot before context compaction.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_FILE="$ROOT_DIR/SESSION.md"
NOW="$(date '+%Y-%m-%d %H:%M:%S %z')"

{
  echo ""
  echo "## Session Snapshot - $NOW"
  echo ""
  echo "### Git Status"
  git -C "$ROOT_DIR" status --short || true
  echo ""
  echo "### Recent Commits"
  git -C "$ROOT_DIR" log -5 --oneline || true
  echo ""
} >> "$OUT_FILE"
