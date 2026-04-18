# Archived: REQ-008, REQ-009 -- List and Show Requirements

**Requirements:** REQ-008, REQ-009
**Implementation commit:** `eae67755fe92851a19cf3d8586ba4a4155d7ae33` (2026-04-14)
**Lifecycle commit:** `2fb0a90048ef67be5de54724722476fd2d7f1453` (mark done, move plan to executed)
**Date archived:** 2026-04-18

## Summary

First implementation plan for the `clif-d` CLI. Established the core infrastructure every subsequent `req` command builds on: `parseFlags`, `resolvePrdPath`, `loadPrd`, the two-level noun-verb router (`<domain> <command>`), canonical `SCHEMA_FIELD_ORDER` ordering for JSON output, and the `selectFields` projection with sensible defaults (absent `status` becomes `"not_started"`, absent `dependencies` becomes `[]`). Shipped `req ls` (with `--status`, `--abstraction`, `--priority`, `--fields`, `--deps`, `--json`, `--plain`) and `req show <REQ-ID>`, plus per-command `--help` and the stdout-is-data / stderr-is-diagnostics / exit-code discipline (0 = success, 1 = logic error, 2 = usage/file error) used by everything that came after.

## Acceptance criteria

- [x] REQ-008: `req ls --status=not_started --abstraction=low` returns a JSON array of matching requirements with default fields; exit 0; empty array when no match.
- [x] REQ-009: `req show <REQ-ID>` returns the full requirement object; exit 0; exit 1 when ID unknown; exit 2 when PRD missing/unparseable.

## Pointers for deep dive

- Implementation diff: `git show eae67755`
- Tests: `cli/test/req-ls.test.js`, `cli/test/req-show.test.js`, `cli/test/helpers.js`
- Lessons promoted to a permanent home: none. The original executed plan and lessons file were compacted into this entry on 2026-04-18; git history preserves them.
