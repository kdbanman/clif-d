import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req show", () => {
  it("shows the full requirement object by ID", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
    assert.equal(req.description, "Desc");
    assert.deepEqual(req.acceptance_criteria, {
      given: "G",
      when: "W",
      then: "T",
    });
    assert.deepEqual(req.dependencies, ["REQ-001"]);
  });

  it("defaults missing status to not_started", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "not_started");
  });

  it("defaults missing dependencies to empty array", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.deepEqual(req.dependencies, []);
  });

  it("exits 1 when requirement ID does not exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("exits 2 when no REQ-ID argument given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "show"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /required|REQ-ID/i);
  });

  it("accepts explicit prd-path after REQ-ID", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["req", "show", "REQ-001", prdPath]);
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-001");
  });
});
