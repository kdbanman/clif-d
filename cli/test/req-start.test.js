import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req start", () => {
  it("sets status to in_progress and outputs updated requirement", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "start", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-001");
    assert.equal(req.status, "in_progress");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const updated = prd.requirements.find((r) => r.id === "REQ-001");
    assert.equal(updated.status, "in_progress");
  });

  it("does not leave temp files on success", () => {
    const dir = withFixture(MINIMAL_PRD);
    run(["req", "start", "REQ-001"], { cwd: dir });
    const files = fs.readdirSync(path.join(dir, "clif-d"));
    const tmpFiles = files.filter((f) => f.includes(".tmp."));
    assert.equal(tmpFiles.length, 0);
  });

  it("exits 1 when requirement is already done", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[1].status = "done";
    prd.requirements[1].implementation_commit = "abc1234";
    const dir = withFixture(prd);
    const result = run(["req", "start", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /done|terminal|cannot/i);
  });

  it("exits 1 when requirement ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "start", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("exits 2 when no REQ-ID argument given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "start"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("is idempotent -- starting an in_progress requirement succeeds", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(["req", "start", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
  });

  it("can start a blocked requirement (unblock)", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "blocked";
    const dir = withFixture(prd);
    const result = run(["req", "start", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "in_progress");
  });
});
