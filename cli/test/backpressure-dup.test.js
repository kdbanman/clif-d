// Verifies the jscpd duplication gate. Two assertions:
//   1. The real bin/clif-d (via the cli/clif-d.js symlink) passes cleanly --
//      proves the configured thresholds are achievable for current code.
//   2. A copy of bin/clif-d with a deliberately-duplicated 10-line block
//      appended twice fails with a nonzero exit -- proves the gate bites.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const REAL_BIN = path.resolve(CLI_DIR, "..", "bin", "clif-d");

/**
 * Run jscpd against an arbitrary file with the project config. Returns the
 * exit code; jscpd is configured (cli/.jscpd.json) to use exitCode=1 on any
 * detected clone.
 * @param {string} target
 * @returns {number}
 */
function runJscpd(target) {
  const result = spawnSync("npx", ["jscpd", target], {
    cwd: CLI_DIR,
    encoding: "utf8",
    timeout: 30000,
  });
  return result.status ?? 1;
}

/**
 * Run an arbitrary npm script in CLI_DIR with extra positional args.
 * @param {string} script
 * @param {string[]} extraArgs
 * @returns {{ exitCode: number, output: string }}
 */
function runNpmScript(script, extraArgs) {
  const result = spawnSync(
    "npm",
    ["run", "--silent", script, "--", ...extraArgs],
    {
      cwd: CLI_DIR,
      encoding: "utf8",
      timeout: 60000,
    },
  );
  return {
    exitCode: result.status ?? 1,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

describe("Backpressure: duplication gate (jscpd)", () => {
  it("the real bin/clif-d passes the duplication gate", () => {
    // Use the symlink so jscpd applies the project's formatsExts mapping
    // (the .clif-d-extension-less file is mapped to javascript via the
    // symlink's .js extension or the formatsExts entry).
    const result = runJscpd(path.join(CLI_DIR, "clif-d.js"));
    assert.equal(
      result,
      0,
      "bin/clif-d should pass jscpd cleanly at configured thresholds",
    );
  });

  it("the npm-run-dup script wired into 'check' fails on injected duplication", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-dup-int-"));
    const fixture = path.join(dir, "violating.js");
    fs.writeFileSync(
      fixture,
      [
        "function clonedAlphaForCheck(items) {",
        "  const accumulator = [];",
        "  const seen = new Set();",
        "  for (const item of items) {",
        "    if (seen.has(item.id)) { continue; }",
        "    seen.add(item.id);",
        "    accumulator.push(item.value);",
        "  }",
        "  return accumulator;",
        "}",
        "function clonedBetaForCheck(items) {",
        "  const accumulator = [];",
        "  const seen = new Set();",
        "  for (const item of items) {",
        "    if (seen.has(item.id)) { continue; }",
        "    seen.add(item.id);",
        "    accumulator.push(item.value);",
        "  }",
        "  return accumulator;",
        "}",
      ].join("\n"),
    );
    // `npm run dup` runs `jscpd clif-d.js`. Appending the fixture path makes
    // jscpd analyze both files and detect the inter-file duplication. Wiring
    // verification: the npm script preserves jscpd's nonzero exit code.
    const { exitCode, output } = runNpmScript("dup", [fixture]);
    assert.notEqual(exitCode, 0);
    assert.match(output, /duplicat|clone/i);
  });

  it("a file with a deliberately duplicated 10-line block fails the gate", () => {
    const original = fs.readFileSync(REAL_BIN, "utf8");
    const dupBlock = `
function clonedAlphaForTest() {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  return a + b + c + d + e + f + g;
}

function clonedBetaForTest() {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  return a + b + c + d + e + f + g;
}
`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-jscpd-"));
    const injected = path.join(tmpDir, "clif-d-injected.js");
    fs.writeFileSync(injected, original + dupBlock);

    const result = runJscpd(injected);
    assert.notEqual(
      result,
      0,
      "jscpd should fail when a duplicated multi-line block is injected",
    );
  });
});
