#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA="$SKILL_DIR/assets/prd-schema.json"

usage() {
  cat <<EOF
Usage: $(basename "$0") <prd-file>

Validate a PRD JSON file against the PRD schema.

Arguments:
  prd-file    Path to the PRD JSON file to validate

Requires: npx and ajv-cli (installed automatically via npx)

Exit codes:
  0  PRD is valid
  1  PRD is invalid (schema validation errors reported)
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

if [[ ! -f "$SCHEMA" ]]; then
  echo "Error: schema not found: $SCHEMA" >&2
  exit 2
fi

# Validate JSON syntax first
if ! python3 -c "import json, sys; json.load(open(sys.argv[1]))" "$PRD_FILE" 2>/dev/null; then
  echo "Error: $PRD_FILE is not valid JSON" >&2
  exit 1
fi

# Validate against schema using ajv-cli
if npx --yes ajv-cli validate -s "$SCHEMA" -d "$PRD_FILE" 2>&1; then
  echo "Valid: $PRD_FILE conforms to the PRD schema."
  exit 0
else
  echo "" >&2
  echo "Invalid: $PRD_FILE does not conform to the PRD schema." >&2
  exit 1
fi
