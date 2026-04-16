import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function read(dir) {
  return fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8");
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

const REQ_TEMPLATE = {
  title: "t",
  description: "d",
  acceptance_criteria: "ac",
  abstraction_level: "high",
  status: "not_started",
};

function prdWithDuplicateIds() {
  const prd = clone(MINIMAL_PRD);
  prd.requirements.push({ ...REQ_TEMPLATE, id: "REQ-001" });
  return prd;
}

function prdWithCycle() {
  const prd = clone(MINIMAL_PRD);
  prd.requirements = [
    { ...REQ_TEMPLATE, id: "REQ-001", dependencies: ["REQ-002"] },
    { ...REQ_TEMPLATE, id: "REQ-002", dependencies: ["REQ-001"] },
  ];
  return prd;
}

function prdWithDanglingDep() {
  const prd = clone(MINIMAL_PRD);
  prd.requirements = [
    { ...REQ_TEMPLATE, id: "REQ-001", dependencies: ["REQ-999"] },
  ];
  return prd;
}

function prdWithMissingField() {
  const prd = clone(MINIMAL_PRD);
  prd.requirements = [{ id: "REQ-001", title: "only title" }];
  return prd;
}

const INVALID_CASES = [
  { name: "duplicate IDs", make: prdWithDuplicateIds, pattern: /Duplicate REQ/ },
  { name: "dependency cycle", make: prdWithCycle, pattern: /cycle/i },
  { name: "dangling dependency", make: prdWithDanglingDep, pattern: /Dangling dependency/ },
  { name: "missing required field", make: prdWithMissingField, pattern: /Missing required/ },
];

const READ_COMMANDS = [
  ["req", "ls"],
  ["req", "show", "REQ-001"],
  ["req", "next"],
];

const MUTATIONS = [
  ["req", "start", "REQ-001"],
  ["req", "done", "REQ-001", "--commit=abc1234"],
  ["req", "block", "REQ-001"],
];

for (const { name, make, pattern } of INVALID_CASES) {
  describe(`Validation on load: ${name}`, () => {
    for (const cmd of READ_COMMANDS) {
      it(`read command ${cmd.join(" ")} exits 1`, () => {
        const dir = withFixture(make());
        const result = run(cmd, { cwd: dir });
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, pattern);
      });
    }

    for (const cmd of MUTATIONS) {
      it(`mutation ${cmd.join(" ")} exits 1 and leaves PRD unchanged`, () => {
        const dir = withFixture(make());
        const before = read(dir);
        const result = run(cmd, { cwd: dir });
        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, pattern);
        assert.equal(read(dir), before);
      });
    }
  });
}

describe("Validation on load: validate command bypass", () => {
  it("validate still reports issues (does not hard-exit at load time)", () => {
    const dir = withFixture(prdWithCycle());
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    assert.ok(issues.some((i) => /cycle/i.test(i.message)));
  });
});
