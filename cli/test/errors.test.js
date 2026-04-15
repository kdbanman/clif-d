import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

/**
 * Every command that loads the PRD. Each tuple is the argv after the bin name.
 * For mutation commands we pass a valid REQ-ID so that argument parsing
 * reaches the load step.
 */
const PRD_LOADING_COMMANDS = [
  ["req", "ls"],
  ["req", "show", "REQ-001"],
  ["req", "next"],
  ["req", "start", "REQ-001"],
  ["req", "done", "REQ-001", "--commit=abc1234"],
  ["req", "block", "REQ-001"],
  ["req", "dep", "add", "REQ-001", "REQ-002"],
  ["req", "dep", "rm", "REQ-001", "REQ-002"],
  ["validate"],
];

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
}

describe("Error paths: missing PRD file", () => {
  for (const cmd of PRD_LOADING_COMMANDS) {
    it(`${cmd.join(" ")} exits 2 when PRD file is missing`, () => {
      const dir = tmpDir();
      const result = run(cmd, { cwd: dir });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /not found/i);
    });
  }
});

describe("Error paths: malformed JSON", () => {
  for (const cmd of PRD_LOADING_COMMANDS) {
    it(`${cmd.join(" ")} exits 2 when PRD is not valid JSON`, () => {
      const dir = tmpDir();
      fs.mkdirSync(path.join(dir, "clif-d"));
      fs.writeFileSync(path.join(dir, "clif-d", "prd.json"), "not json{{{");
      const result = run(cmd, { cwd: dir });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /parse|json/i);
    });
  }
});

describe("Error paths: unreadable PRD file", () => {
  // chmod 000 cannot make a file unreadable for root. CI and most user
  // shells run as a non-root user, so this test verifies the unreadable-PRD
  // code path on those. When running as root (e.g. some container runtimes),
  // the test is skipped because the precondition cannot be set up.
  const isRoot =
    typeof process.getuid === "function" && process.getuid() === 0;
  it("req ls exits 2 when PRD file has mode 000", { skip: isRoot }, () => {
    const dir = withFixture(MINIMAL_PRD);
    const prdPath = path.join(dir, "clif-d", "prd.json");
    fs.chmodSync(prdPath, 0o000);
    try {
      const result = run(["req", "ls"], { cwd: dir });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /not found/i);
    } finally {
      fs.chmodSync(prdPath, 0o644);
    }
  });
});

describe("Error paths: unknown flags", () => {
  const CASES = [
    { cmd: ["req", "ls", "--bogus"], label: "req ls" },
    { cmd: ["req", "show", "REQ-001", "--bogus"], label: "req show" },
    { cmd: ["req", "next", "--bogus"], label: "req next" },
    { cmd: ["req", "start", "REQ-001", "--bogus"], label: "req start" },
    {
      cmd: ["req", "done", "REQ-001", "--commit=abc1234", "--bogus"],
      label: "req done",
    },
    { cmd: ["req", "block", "REQ-001", "--bogus"], label: "req block" },
    { cmd: ["validate", "--bogus"], label: "validate" },
  ];
  for (const { cmd, label } of CASES) {
    it(`${cmd.join(" ")} exits 2 with 'Unknown flag' for ${label}`, () => {
      const dir = withFixture(MINIMAL_PRD);
      const result = run(cmd, { cwd: dir });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /Unknown flag/);
      assert.match(result.stderr, /--bogus/);
    });
  }

  it("short unknown flag -z is also rejected", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "-z"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /Unknown flag/);
  });
});

describe("Error paths: empty flag values", () => {
  const CASES = [
    ["req", "ls", "--status="],
    ["req", "ls", "--abstraction="],
    ["req", "ls", "--fields="],
    ["req", "done", "REQ-001", "--commit="],
  ];
  for (const cmd of CASES) {
    it(`${cmd.join(" ")} exits 2`, () => {
      const dir = withFixture(MINIMAL_PRD);
      const result = run(cmd, { cwd: dir });
      assert.equal(result.exitCode, 2);
      assert.match(result.stderr, /non-empty value/);
    });
  }
});

describe("Flag policy: duplicate flags (last wins)", () => {
  it("req ls --status=done --status=not_started uses the last value", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--status=done,not_started"], {
      cwd: dir,
    });
    // Baseline: both REQ-001 (not_started) and REQ-002 (done) match
    assert.equal(result.exitCode, 0);
    const baseline = JSON.parse(result.stdout);
    assert.equal(baseline.length, 2);

    const dupResult = run(
      ["req", "ls", "--status=done", "--status=not_started"],
      { cwd: dir },
    );
    assert.equal(dupResult.exitCode, 0);
    const reqs = JSON.parse(dupResult.stdout);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, "REQ-001");
    assert.equal(reqs[0].status, "not_started");
  });
});
