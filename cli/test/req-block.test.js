import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req block", () => {
  it("sets status to blocked", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "blocked");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = prd.requirements.find((r) => r.id === "REQ-001");
    assert.equal(r.status, "blocked");
  });

  it("can block an in_progress requirement", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "blocked");
  });

  it("exits 1 when requirement is already done", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    prd.requirements[0].implementation_commit = "abc1234";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /done|cannot/i);
  });

  it("exits 1 when requirement not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block", "REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when no REQ-ID given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "block"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("is idempotent -- blocking a blocked requirement succeeds", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "blocked";
    const dir = withFixture(prd);
    const result = run(["req", "block", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
  });

  it("preserves all other PRD fields after mutation", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.context.push({
      id: "CTX-001",
      title: "Test context",
      description: "Test",
      type: "constraint",
    });
    const dir = withFixture(prd);
    run(["req", "start", "REQ-001"], { cwd: dir });
    const updated = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(updated.context.length, 1);
    assert.equal(updated.context[0].id, "CTX-001");
    const req2 = updated.requirements.find((r) => r.id === "REQ-002");
    assert.equal(req2.title, "Second requirement");
    assert.equal(updated.product_name, "test");
  });
});
