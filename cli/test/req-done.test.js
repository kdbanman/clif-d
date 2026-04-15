import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req done", () => {
  it("sets status to done with commit SHA", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc1234def"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.status, "done");
    assert.equal(req.implementation_commit, "abc1234def");

    const updated = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = updated.requirements.find((r) => r.id === "REQ-001");
    assert.equal(r.status, "done");
    assert.equal(r.implementation_commit, "abc1234def");
  });

  it("accepts -c shorthand for --commit", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "-c", "abc1234def"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.implementation_commit, "abc1234def");
  });

  it("can mark a not_started requirement done (skip in_progress)", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc1234"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
  });

  it("exits 1 when --commit is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "done", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /--commit|commit/i);
  });

  it("exits 1 when SHA is invalid (too short)", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /sha|hex|commit/i);
  });

  it("exits 1 when SHA contains non-hex characters", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-001", "--commit=xyz1234"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when requirement is already done", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    prd.requirements[0].implementation_commit = "abc1234";
    const dir = withFixture(prd);
    const result = run(
      ["req", "done", "REQ-001", "--commit=def5678"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /done|already/i);
  });

  it("exits 1 when requirement not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "done", "REQ-999", "--commit=abc1234"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 1);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(
      ["req", "done", "REQ-001", "--commit=abc1234", prdPath],
    );
    assert.equal(result.exitCode, 0);
    const updated = JSON.parse(fs.readFileSync(prdPath, "utf8"));
    const r = updated.requirements.find((r) => r.id === "REQ-001");
    assert.equal(r.status, "done");
  });
});
