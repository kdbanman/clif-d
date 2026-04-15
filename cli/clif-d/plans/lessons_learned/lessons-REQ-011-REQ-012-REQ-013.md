# Lessons Learned: REQ-011, REQ-012, REQ-013 (req start/done/block)

Implementation went smoothly, with no user corrections or surprise failures.
The plan's decomposition mapped cleanly onto the existing `bin/clif-d`
handler-per-command structure, and the infrastructure from the REQ-008/009
plans (flag parsing, PRD loading, router, `fullRequirementObject`) was
reused verbatim.

One small note worth recording:

- **`flagsWithValues` must be extended for new value-taking short flags.**
  The existing `parseFlags` treats any bare `-x` (length-2 short flag) as
  boolean unless it appears in the `flagsWithValues` set. Adding `-c` /
  `--commit` required appending both to that set so that `-c abc1234` would
  consume the next argument as the value rather than dropping `abc1234` into
  `positional`. Future plans that introduce new short flags taking a value
  should do the same. The `--key=value` long-form path always works
  regardless, so tests that only exercise `--commit=...` will not catch a
  missing entry here.
