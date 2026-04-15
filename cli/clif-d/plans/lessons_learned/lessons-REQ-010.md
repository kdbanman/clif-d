# Lessons Learned: REQ-010 (`clif-d req next`)

**Implementation commit:** bd465f0817f2d4c0add53337e69ab3d37849521b

Implementation went smoothly. The plan's decomposition (happy path, priority ordering, dep gating, exit-1 diagnostics, prd-path/help) mapped directly to a single test file with 14 cases that all passed after one round of implementation.

## Minor notes

- **ESLint `unicorn/prefer-switch`.** Adding a third `else-if` branch to the `req` router tipped the chain over the lint rule's threshold. Converted the `if/else-if/else` router to a `switch` statement. Each `case` uses a block scope so `const prdPath`/`const prd` do not leak between cases. Future subcommand additions should extend the `switch` directly.
- **Unused-parameter lint.** Initially passed `flags` into `reqNext` to mirror `reqShow`. `no-unused-vars` flagged it even with the `_flags` underscore prefix, so dropped the parameter entirely. Lesson: the existing ESLint config rejects underscore-prefixed unused params; just omit them.
- **Prettier re-ran on the help text.** `npx prettier --write` collapsed a two-line `stderr.write` call into one line after the manual edit. No action needed, just worth knowing the formatter will touch whatever you add.
- **`npm install` needed before first `npm run check`.** Fresh worktree had no `cli/node_modules/`, so prettier/eslint were missing. First aggregate check failed with `prettier: command not found` until install completed.
