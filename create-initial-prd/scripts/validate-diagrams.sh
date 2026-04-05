#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") <prd-file>

Validate that architecture diagram files referenced in a PRD exist and are parseable.

Checks:
  - All diagram_file paths in architecture items resolve to existing files
  - .mmd files are validated with mmdc (Mermaid CLI) if available, otherwise existence-only
  - .puml files are checked for existence only

Diagram paths are resolved relative to the PRD file's directory.

Requires: jq

Exit codes:
  0  All diagram references are valid
  1  Issues found
  2  Usage error
EOF
}

if [[ $# -lt 1 ]] || [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  usage
  exit 2
fi

PRD_FILE="$1"

if [[ ! -f "$PRD_FILE" ]]; then
  echo "Error: file not found: $PRD_FILE" >&2
  exit 2
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 2
fi

if ! jq empty "$PRD_FILE" 2>/dev/null; then
  echo "Error: $PRD_FILE is not valid JSON" >&2
  exit 2
fi

PRD_DIR="$(cd "$(dirname "$PRD_FILE")" && pwd)"
ERRORS=0
CHECKED=0

error() {
  echo "ERROR: $*" >&2
  ERRORS=$((ERRORS + 1))
}

# Check if mmdc (Mermaid CLI) is available
HAS_MMDC=false
if command -v mmdc &>/dev/null; then
  HAS_MMDC=true
fi

# Extract diagram_file values with their architecture IDs
while IFS=$'\t' read -r arch_id diagram_file; do
  [[ -z "$diagram_file" ]] && continue
  CHECKED=$((CHECKED + 1))

  # Resolve relative to PRD directory
  resolved="$PRD_DIR/$diagram_file"

  if [[ ! -f "$resolved" ]]; then
    error "$arch_id references diagram '$diagram_file' which does not exist (resolved: $resolved)"
    continue
  fi

  # Validate .mmd files with mmdc if available
  if [[ "$diagram_file" == *.mmd ]] && $HAS_MMDC; then
    tmp_out=$(mktemp /tmp/mmd-validate-XXXXXX.svg)
    if ! mmdc -i "$resolved" -o "$tmp_out" 2>/dev/null; then
      error "$arch_id references diagram '$diagram_file' which failed Mermaid parsing"
    fi
    rm -f "$tmp_out"
  fi

  echo "OK: $arch_id -> $diagram_file"
done < <(jq -r '.architecture[]? | select(.diagram_file) | [.id, .diagram_file] | @tsv' "$PRD_FILE" 2>/dev/null)

# Summary
if [[ $CHECKED -eq 0 ]]; then
  echo "No diagram references found in $PRD_FILE."
  exit 0
elif [[ $ERRORS -eq 0 ]]; then
  echo "Valid: all $CHECKED diagram reference(s) in $PRD_FILE are valid."
  exit 0
else
  echo "" >&2
  echo "Found $ERRORS issue(s) across $CHECKED diagram reference(s) in $PRD_FILE." >&2
  exit 1
fi
