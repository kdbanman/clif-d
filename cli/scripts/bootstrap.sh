#!/usr/bin/env bash
# clif-d CLI -- dev environment bootstrap.
#
# Single entry point for preparing the cli/ dev tooling. Idempotent,
# non-interactive, no sudo, no shell-profile edits. Assumes Node.js 18+
# is already on PATH (Claude Code guarantees this in plugin environments;
# elsewhere install via nvm/fnm/volta/mise/asdf or the OS package manager).
#
# See cli/clif-d/dev-environment.md for rationale.

set -euo pipefail

# Resolve script location and repo layout without depending on CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CLI_DIR}/.." && pwd)"

REQUIRED_NODE_MAJOR=18

log()  { printf '[bootstrap] %s\n' "$*"; }
fail() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 2; }

# --- 1. Verify Node.js ---------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
    fail "node is not on PATH. Install Node.js ${REQUIRED_NODE_MAJOR}+ (nvm/fnm/volta/mise/asdf/OS package) and rerun."
fi

NODE_VERSION="$(node --version)"   # e.g. v18.20.4
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"

if ! [[ "${NODE_MAJOR}" =~ ^[0-9]+$ ]]; then
    fail "Could not parse Node major version from '${NODE_VERSION}'."
fi

if (( NODE_MAJOR < REQUIRED_NODE_MAJOR )); then
    fail "Node ${NODE_VERSION} is too old. Required: ${REQUIRED_NODE_MAJOR}+. Pin recorded in cli/.nvmrc."
fi

log "node ${NODE_VERSION} -- ok"

# --- 2. Verify npm -------------------------------------------------------

if ! command -v npm >/dev/null 2>&1; then
    fail "npm is not on PATH. It should ship with Node.js -- check your Node installation."
fi

log "npm $(npm --version) -- ok"

# --- 3. Install dev dependencies from lockfile --------------------------

# In a linked worktree, .git is a file rather than a directory. node_modules is
# git-ignored, so it is absent in fresh worktrees. Copy from the primary worktree
# when available to avoid a slow npm ci re-run.
cd "${CLI_DIR}"
# Freshness check: npm writes node_modules/.package-lock.json on every install,
# mirroring the top-level package-lock.json. If the top-level lockfile is newer
# (or the marker is absent), node_modules is stale relative to declared deps.
NM_MARKER="${CLI_DIR}/node_modules/.package-lock.json"
LOCKFILE="${CLI_DIR}/package-lock.json"
node_modules_is_fresh() {
    [[ -d "${CLI_DIR}/node_modules" ]] || return 1
    [[ -f "${NM_MARKER}" ]] || return 1
    [[ -f "${LOCKFILE}" ]] || return 0  # no lockfile to compare against
    [[ ! "${LOCKFILE}" -nt "${NM_MARKER}" ]]
}
if node_modules_is_fresh; then
    log "node_modules present and in sync with package-lock.json -- skipping"
elif [[ -f "${REPO_ROOT}/.git" ]]; then
    # Linked worktree: .git is a file, not a directory. Copy node_modules from the
    # primary worktree to avoid a slow npm ci re-run.
    COMMON_GIT="$(git -C "${REPO_ROOT}" rev-parse --git-common-dir)"
    # --git-common-dir may return a relative path; make it absolute.
    if [[ "${COMMON_GIT}" != /* ]]; then
        COMMON_GIT="$(cd "${REPO_ROOT}/${COMMON_GIT}" && pwd)"
    fi
    PRIMARY_NM="$(cd "${COMMON_GIT}/.." && pwd)/cli/node_modules"
    if [[ -d "${PRIMARY_NM}" ]]; then
        log "linked worktree -- copying node_modules from primary worktree"
        cp -r "${PRIMARY_NM}" "${CLI_DIR}/node_modules"
    else
        log "linked worktree -- primary node_modules absent, running npm ci"
        npm ci
    fi
else
    log "running npm ci in ${CLI_DIR}"
    npm ci
fi

# --- 4. Confirm husky hooks registered ----------------------------------

HOOK="${CLI_DIR}/.husky/pre-commit"
if [[ ! -f "${HOOK}" ]]; then
    fail "husky pre-commit hook is missing at ${HOOK} after npm ci. The 'prepare' script may have failed."
fi
log "husky pre-commit hook present -- ok"

# --- 5. Confirm CLI executable ------------------------------------------

CLI_BIN="${REPO_ROOT}/bin/clif-d"
if [[ ! -x "${CLI_BIN}" ]]; then
    fail "${CLI_BIN} is not executable. chmod +x it and recommit."
fi
log "bin/clif-d is executable -- ok"

log "bootstrap complete. Next: ./cli/scripts/verify-env.sh"
