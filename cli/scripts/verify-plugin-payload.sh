#!/usr/bin/env bash
# clif-d plugin -- marketplace payload verification.
#
# Static preflight for what `/plugin install clif-d@clif-d` will ship to end
# users. Validates the manifest, executable, and shebang that land in
# ~/.claude/plugins/cache/<id>/ and are added to the Bash tool's PATH when
# the plugin is enabled.
#
# End-to-end (manual, in a scratch Claude Code session):
#   1. In any scratch directory, start Claude Code.
#   2. /plugin marketplace add <absolute-path-to-this-repo>
#      /plugin install clif-d@clif-d
#   3. Ask Claude to run `clif-d --help` via the Bash tool. It should print
#      the usage banner without an absolute path. That confirms bin/ landed
#      on the Bash tool's PATH.
#   4. Ask Claude to run `which clif-d` to confirm the resolved path lives
#      under ~/.claude/plugins/cache/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PASS=0
fail() { printf '[payload] %s -- FAIL: %s\n' "$1" "$2" >&2; exit 1; }
ok()   { printf '[payload] %s -- ok\n' "$1"; PASS=$((PASS + 1)); }

# --- .claude-plugin/plugin.json --------------------------------------------

PLUGIN_JSON="${REPO_ROOT}/.claude-plugin/plugin.json"
[[ -f "${PLUGIN_JSON}" ]] || fail ".claude-plugin/plugin.json" "missing"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "${PLUGIN_JSON}" \
    >/dev/null || fail ".claude-plugin/plugin.json" "not valid JSON"
ok ".claude-plugin/plugin.json parses"

# --- .claude-plugin/marketplace.json ---------------------------------------

MARKETPLACE_JSON="${REPO_ROOT}/.claude-plugin/marketplace.json"
[[ -f "${MARKETPLACE_JSON}" ]] || fail ".claude-plugin/marketplace.json" "missing"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "${MARKETPLACE_JSON}" \
    >/dev/null || fail ".claude-plugin/marketplace.json" "not valid JSON"
ok ".claude-plugin/marketplace.json parses"

# --- version sync between the two manifests --------------------------------

PLUGIN_V="$(node -e "console.log(require(process.argv[1]).version || '')" "${PLUGIN_JSON}")"
MKT_V="$(node -e "
const m = require(process.argv[1]);
const e = (m.plugins || []).find(p => p.name === 'clif-d');
console.log(e ? (e.version || '') : '');
" "${MARKETPLACE_JSON}")"
if [[ -z "${PLUGIN_V}" || -z "${MKT_V}" ]]; then
    fail "version sync" "plugin.json=${PLUGIN_V:-<missing>} marketplace.json=${MKT_V:-<missing>}"
fi
if [[ "${PLUGIN_V}" != "${MKT_V}" ]]; then
    fail "version sync" "plugin.json=${PLUGIN_V} marketplace.json=${MKT_V}"
fi
ok "plugin.json version matches marketplace entry (${PLUGIN_V})"

# --- bin/clif-d is executable with a Node shebang --------------------------

CLI_BIN="${REPO_ROOT}/bin/clif-d"
[[ -f "${CLI_BIN}" ]] || fail "bin/clif-d" "missing"
[[ -x "${CLI_BIN}" ]] || fail "bin/clif-d" "not executable (chmod +x)"
FIRST_LINE="$(head -n1 "${CLI_BIN}")"
if [[ "${FIRST_LINE}" != "#!/usr/bin/env node" ]]; then
    fail "bin/clif-d shebang" "expected '#!/usr/bin/env node', got '${FIRST_LINE}'"
fi
ok "bin/clif-d is executable with Node shebang"

# --- CLI runs --------------------------------------------------------------

if "${CLI_BIN}" --help >/dev/null 2>&1; then
    ok "bin/clif-d --help runs"
else
    fail "bin/clif-d --help" "exited non-zero"
fi

# --- bin/ payload audit ----------------------------------------------------
#
# Claude Code adds this directory to the Bash tool's PATH. Anything
# executable here becomes a user-visible command. CLAUDE.md is fine (not
# executable; not on PATH as a command), but flag anything else so it is a
# deliberate decision, not an accident.

while IFS= read -r f; do
    name="$(basename "$f")"
    case "$name" in
        clif-d|CLAUDE.md) ;;
        *) fail "bin/${name}" "unexpected file in bin/ -- will ship to users" ;;
    esac
done < <(find "${REPO_ROOT}/bin" -maxdepth 1 -type f)
ok "bin/ contains only expected files"

printf '\n[payload] %d checks passed.\n' "${PASS}"
printf '[payload] next: run the in-session steps in this script header.\n'
