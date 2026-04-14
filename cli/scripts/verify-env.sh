#!/usr/bin/env bash
# clif-d CLI -- dev environment verification.
#
# Runs every quality check prescribed by cli/clif-d/backpressure.md plus a
# sanity invocation of bin/clif-d. Fails on the first hard failure. The test
# step is currently soft (warn-only) because cli/test/ is empty until REQ-008
# lands; once the first tests are written, flip TESTS_SOFT=0 below.
#
# See cli/clif-d/dev-environment.md section 7.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CLI_DIR}/.." && pwd)"

# node --test exits 0 when no tests are discovered, so this can stay hard.
# Flip to 1 temporarily if a transient test-framework issue blocks verification.
TESTS_SOFT=0

PASS=0
SOFT_FAIL=0

log()   { printf '[verify] %s\n' "$*"; }
ok()    { printf '[verify] %s -- ok\n' "$1"; PASS=$((PASS + 1)); }
warn()  { printf '[verify] %s -- WARN: %s\n' "$1" "$2" >&2; SOFT_FAIL=$((SOFT_FAIL + 1)); }
fail()  { printf '[verify] %s -- FAIL: %s\n' "$1" "$2" >&2; exit 1; }

# --- 1. Node version ----------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
    fail "node" "not on PATH; run ./cli/scripts/bootstrap.sh first"
fi
NODE_VERSION="$(node --version)"
NODE_MAJOR="${NODE_VERSION#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
if (( NODE_MAJOR < 18 )); then
    fail "node" "version ${NODE_VERSION} is below the pin of 18"
fi
ok "node ${NODE_VERSION}"

# --- 2. Prettier format check -------------------------------------------

cd "${CLI_DIR}"
if npm run --silent format:check >/dev/null 2>&1; then
    ok "prettier format:check"
else
    fail "prettier format:check" "run 'cd cli && npm run format' to fix"
fi

# --- 3. ESLint ----------------------------------------------------------

if npm run --silent lint >/dev/null 2>&1; then
    ok "eslint"
else
    fail "eslint" "run 'cd cli && npm run lint' to see violations"
fi

# --- 4. TypeScript ------------------------------------------------------

if npm run --silent typecheck >/dev/null 2>&1; then
    ok "tsc --noEmit"
else
    fail "tsc --noEmit" "run 'cd cli && npm run typecheck' to see errors"
fi

# --- 5. Tests (soft until REQ-008) --------------------------------------

TEST_OUT="$(mktemp)"
trap 'rm -f "${TEST_OUT}"' EXIT
if npm test >"${TEST_OUT}" 2>&1; then
    ok "node --test"
else
    if (( TESTS_SOFT == 1 )); then
        warn "node --test" "no tests yet (expected until REQ-008 lands)"
    else
        cat "${TEST_OUT}" >&2
        fail "node --test" "test suite failed; see output above"
    fi
fi

# --- 6. CLI sanity ------------------------------------------------------

CLI_BIN="${REPO_ROOT}/bin/clif-d"
if [[ ! -x "${CLI_BIN}" ]]; then
    fail "bin/clif-d" "not executable"
fi
if "${CLI_BIN}" --help >/dev/null 2>&1; then
    ok "bin/clif-d --help"
else
    fail "bin/clif-d --help" "CLI did not exit cleanly; run it directly to see the error"
fi

# --- Summary ------------------------------------------------------------

printf '\n[verify] %d hard checks passed, %d soft warnings.\n' "${PASS}" "${SOFT_FAIL}"
if (( SOFT_FAIL > 0 )); then
    printf '[verify] soft warnings are expected in the current PRD baseline; see cli/clif-d/dev-environment.md section 9.\n'
fi
