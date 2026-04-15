# Lessons Learned: REQ-014 (validate command)

Implementation proceeded step by step with no significant surprises. One
noteworthy observation:

- **MINIMAL_PRD fixture was not itself structurally valid.** Before this plan,
  `cli/test/helpers.js` set `status: "done"` on REQ-002 without an
  `implementation_commit`. That was invisible until the validate command's
  first test expected an empty issues array for the fixture. Fixed by adding
  `implementation_commit: "abc1234"` to REQ-002 in the shared fixture. Worth
  remembering: any future check that validates the fixture itself will
  retroactively surface omissions like this, so shared fixtures should be
  kept fully schema-conformant.

No plan deviations, no regressions, no tooling issues.
