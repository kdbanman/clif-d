# CLI Design Conventions Guide

A summary of CLI design conventions relevant to CLIF-D product requirements, drawn from [Command Line Interface Guidelines](https://clig.dev/).

---

## Exit Codes

- **0**: Success.
- **1**: General error (catchall for unspecified failures).
- **2**: Usage error (invalid arguments, missing required flags).
- Map additional non-zero codes to the most important failure modes for better diagnostics in scripts.
- Exit codes are how scripts determine success or failure — accuracy is critical.

---

## Arguments and Flags

### Arguments (positional)

- Order matters: `cp source destination`.
- Multiple arguments are fine for homogeneous inputs (`rm file1.txt file2.txt`, enabling globbing like `rm *.txt`).
- If a command needs two or more arguments for *different* purposes, prefer flags instead — flags are self-documenting and order-independent.

### Flags (named options)

- Always provide a `--long-form` for every flag. Long forms make scripts readable without constant lookup.
- Reserve single-letter short forms (`-v`) for commonly used options only. Namespace pollution forces awkward letters later.
- Support both `--flag value` and `--flag=value` syntax where practical.
- Make flags and arguments order-independent when possible.
- Boolean flags require no value; presence means true.

### Standard flag names

Use these when they fit — users expect them:

| Flag | Meaning |
|------|---------|
| `-h, --help` | Display help text |
| `-v, --version` | Display version |
| `-q, --quiet` | Suppress non-essential output |
| `-d, --debug` | Show debug output |
| `-f, --force` | Skip safety checks / confirmations |
| `-n, --dry-run` | Describe what would happen without doing it |
| `-o, --output` | Output file path |
| `--json` | Structured JSON output |
| `--plain` | Plain tabular text output |
| `--no-input` | Disable interactive prompts |
| `--no-color` | Disable colored output |

### Defaults

- Make defaults sensible for the majority of users — most won't customize.
- Never *require* interactive prompts; always provide a flag or argument alternative.
- Refuse prompts when stdin is not an interactive terminal (piped data).

---

## stdout vs stderr

The separation of stdout and stderr is the foundation of CLI composability.

### stdout

- Primary output: the data the command exists to produce.
- Machine-readable output (JSON, structured data) goes here.
- When piped, stdout feeds the next command in the pipeline.

### stderr

- Errors, warnings, progress indicators, log messages, and human-readable status updates.
- When stdout is piped, stderr still displays to the user.
- Never feed error messages into the next command.

### Rationale

As Doug McIlroy put it: *"Expect the output of every program to become the input to another, as yet unknown, program."* Clean separation lets a single invocation serve both humans (via stderr) and machines (via stdout).

---

## Error Output

### Rewrite errors for humans

Intercept expected errors and rewrite them as actionable guidance:

> Can't write to file.txt. You might need to make it writable by running `chmod +w file.txt`.

### Signal-to-noise

- Group repeated errors under explanatory headers instead of printing identical lines.
- Put the most critical information last — that's where the eye rests after scrolling.
- Use red text sparingly and intentionally for genuine errors.

### Unexpected errors

- Provide debug/traceback information, but not by default — gate behind `--debug` or write to a log file.
- Include instructions for submitting bug reports.
- Don't print raw stack traces or exception dumps to users.

### Don't treat stderr like a log file

Avoid timestamp prefixes and log-level labels in normal output. Reserve that verbosity for `--debug` mode.

---

## Composability and Piping

### Design as components, not monoliths

Programs will be used in pipelines developers didn't anticipate. The only question is whether your tool is a well-behaved component.

### Piping conventions

- Line-based plain text is the default pipe format. One record per line.
- Support `-` to read from stdin or write to stdout (e.g., `tar xvf -`).
- Provide `--json` for structured output that works with `jq`.
- Provide `--plain` for tabular text when human-readable formatting would break piping.

### TTY detection

Detect whether stdout/stderr connects to an interactive terminal and adjust:

| | Interactive (TTY) | Non-interactive (pipe/file) |
|---|---|---|
| **Formatting** | Colors, spacing, tables | Plain text, one record per line |
| **Progress** | Spinners, progress bars | Silent or periodic line updates |
| **Errors** | Friendly, colored | Clean text, no ANSI escapes |

### Disable colors when

- stdout/stderr is not a TTY
- `NO_COLOR` environment variable is set
- `TERM=dumb`
- `--no-color` flag is passed

---

## Help Text

### When to show help

- Full help on `-h` or `--help` (ignore other flags when help is requested — allow appending `-h` to anything).
- Concise help when run with no arguments (if arguments are required).
- Never hang silently waiting for piped input on an interactive terminal — show help or a message immediately.

### Full help should include

1. Clear description of what the program does
2. Usage/syntax line
3. Explanation of important flags (most common first)
4. Examples — especially common complex uses (users prefer examples over other docs)
5. Link to full documentation
6. Link to support / issue tracker

### Organization

- Group related commands together.
- For multi-command tools, support `tool help`, `tool help subcommand`, and `tool subcommand --help`.
- Lead with examples — they're the most-read part of help text.

---

## Output Formatting

### Success output

- Confirm what happened, briefly. UNIX tradition is silence when nothing is wrong, but state-changing operations should always report what changed.
- Provide `-q` / `--quiet` for scripts that want silence.

### Progress and responsiveness

- Print something within 100ms if the operation might take time. Responsiveness matters more than raw speed.
- Show a spinner or progress bar for long operations. Include estimated time remaining if available.
- On error, redisplay logs that were hidden behind a progress indicator.

### Structured output modes

- **Default (TTY)**: Human-readable formatted text, colors, tables.
- **`--json`**: Structured JSON for programmatic consumption. Integrates with `jq` and web tooling.
- **`--plain`**: Tabular plain text for `grep`/`awk`/`cut` pipelines.

---

## Dangerous Operations

Scale confirmation to risk:

| Risk | Convention |
|------|-----------|
| Mild (small local change) | Optional confirmation |
| Moderate (large local change, remote deletion) | Prompt for confirmation; offer `--dry-run` |
| Severe (complex/irreversible destruction) | Require typing the name of the resource being deleted |

Always support `--force` (or `--confirm=<value>`) so scripts can bypass prompts.

---

## Secrets

- **Never** accept secrets via flags (visible in `ps` output and shell history).
- **Never** accept secrets via environment variables (leaked in logs, `docker inspect`, `systemctl show`).
- Use `--password-file`, stdin pipes, or credential stores.

---

## Configuration Precedence

Highest to lowest:

1. Flags passed on the command line
2. Environment variables
3. Project-level configuration (`.env`, `.myapp.yml`)
4. User-level configuration (`~/.config/myapp/config`)
5. System-wide configuration (`/etc/myapp/config`)

Follow the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/) for config file locations.

---

## Subcommands

- Use the same flag names across all subcommands for consistency.
- Use consistent verb/noun ordering: pick `tool noun verb` or `tool verb noun` and stick with it.
- Don't allow arbitrary prefix abbreviations of subcommand names — they break when new commands are added.
- Don't create catch-all default subcommands — they prevent ever adding that name as an explicit subcommand.

---

## Robustness

- **Crash-only design**: Avoid requiring cleanup after interruption. Defer cleanup to the next run.
- **Idempotence**: Users should be able to re-run a command to recover from transient failures.
- **Timeouts**: Make network timeouts configurable with sensible defaults. Don't hang forever.
- **Signals**: Exit immediately on Ctrl-C. If cleanup is needed, say so, add a timeout to cleanup, and skip cleanup on a second Ctrl-C.

---

## Naming

- Use a simple, memorable word — not generic terms like `convert` or `download`.
- Lowercase letters and dashes only.
- Keep it short (users type it constantly).
- Consider typing ergonomics.
