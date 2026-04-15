# Implementation rules for `bin/clif-d`

This file scopes additional rules to anyone editing `bin/clif-d` (or the lint/typecheck symlink at `cli/clif-d.js -> ../bin/clif-d`). Closest-file-wins per the AGENTS.md convention: the top-level `AGENTS.md` still applies; the rules here are additive.

The canonical content lives in `bin/CLAUDE.md` -- read that file. The two are kept in sync; AGENTS.md and GEMINI.md exist because some agent harnesses only load files matching their own filename. To avoid drift, follow `bin/CLAUDE.md` as the source.

If you change the rules in `bin/CLAUDE.md`, update `bin/GEMINI.md` to point at the same content, and update this file's pointer if needed.
