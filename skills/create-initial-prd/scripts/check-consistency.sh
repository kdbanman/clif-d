#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") <prd-file>

Check cross-reference consistency in a PRD JSON file.

Verifies:
  - All dependency refs (REQ-NNN) point to existing requirements
  - All context_refs (CTX-NNN) point to existing context items
  - All architecture_refs (ARCH-NNN) point to existing architecture items
  - Inline ID mentions in description text reference existing items
  - No self-references in dependencies
  - No duplicate IDs

Requires: jq

Exit codes:
  0  All references are consistent
  1  Consistency issues found
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

# Validate JSON syntax
if ! jq empty "$PRD_FILE" 2>/dev/null; then
  echo "Error: $PRD_FILE is not valid JSON" >&2
  exit 2
fi

ERRORS=0

error() {
  echo "ERROR: $*" >&2
  ERRORS=$((ERRORS + 1))
}

# Extract all defined IDs
REQ_IDS=$(jq -r '.requirements[]?.id // empty' "$PRD_FILE" 2>/dev/null)
CTX_IDS=$(jq -r '.context[]?.id // empty' "$PRD_FILE" 2>/dev/null)
ARCH_IDS=$(jq -r '.architecture[]?.id // empty' "$PRD_FILE" 2>/dev/null)

ALL_IDS=$(printf '%s\n' $REQ_IDS $CTX_IDS $ARCH_IDS | sort)

# Check for duplicate IDs
DUPES=$(echo "$ALL_IDS" | sort | uniq -d)
if [[ -n "$DUPES" ]]; then
  while IFS= read -r dup; do
    error "Duplicate ID: $dup"
  done <<< "$DUPES"
fi

id_exists() {
  local id="$1"
  local id_list="$2"
  echo "$id_list" | grep -qxF "$id"
}

# Check dependency refs
while IFS=$'\t' read -r req_id dep_id; do
  if [[ "$req_id" == "$dep_id" ]]; then
    error "$req_id has self-reference in dependencies"
  elif ! id_exists "$dep_id" "$REQ_IDS"; then
    error "$req_id depends on $dep_id which does not exist"
  fi
done < <(jq -r '.requirements[]? | select(.dependencies) | .id as $rid | .dependencies[]? | [$rid, .] | @tsv' "$PRD_FILE" 2>/dev/null)

# Check context_refs
while IFS=$'\t' read -r req_id ctx_id; do
  if ! id_exists "$ctx_id" "$CTX_IDS"; then
    error "$req_id references context $ctx_id which does not exist"
  fi
done < <(jq -r '.requirements[]? | select(.context_refs) | .id as $rid | .context_refs[]? | [$rid, .] | @tsv' "$PRD_FILE" 2>/dev/null)

# Check architecture_refs
while IFS=$'\t' read -r req_id arch_id; do
  if ! id_exists "$arch_id" "$ARCH_IDS"; then
    error "$req_id references architecture $arch_id which does not exist"
  fi
done < <(jq -r '.requirements[]? | select(.architecture_refs) | .id as $rid | .architecture_refs[]? | [$rid, .] | @tsv' "$PRD_FILE" 2>/dev/null)

# Check inline ID references in description text
while IFS=$'\t' read -r item_id desc; do
  # Extract all ID-like patterns from description
  inline_refs=$(echo "$desc" | grep -oE '(REQ|CTX|ARCH)-[0-9]{3}' || true)
  for ref in $inline_refs; do
    if ! echo "$ALL_IDS" | grep -qxF "$ref"; then
      error "$item_id description mentions $ref which does not exist"
    fi
  done
done < <(jq -r '(.requirements[]?, .context[]?, .architecture[]?) | [.id, .description] | @tsv' "$PRD_FILE" 2>/dev/null)

# Summary
if [[ $ERRORS -eq 0 ]]; then
  echo "Consistent: all cross-references in $PRD_FILE are valid."
  exit 0
else
  echo "" >&2
  echo "Found $ERRORS consistency issue(s) in $PRD_FILE." >&2
  exit 1
fi
