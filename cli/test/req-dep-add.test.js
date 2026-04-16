import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function threeReqPrd() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.requirements.push({
    id: "REQ-003",
    title: "Third",
    description: "D",
    acceptance_criteria: "Done",
    abstraction_level: "high",
    status: "not_started",
  });
  return prd;
}

describe("req dep add", () => {
  it("adds a dependency edge and persists it", () => {
    const dir = withFixture(threeReqPrd());
    const result = run(["req", "dep", "add", "REQ-001", "REQ-003"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const updated = JSON.parse(result.stdout);
    assert.deepEqual(updated.dependencies, ["REQ-003"]);
    const disk = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = disk.requirements.find(
      (/** @type {{ id: string }} */ x) => x.id === "REQ-001",
    );
    assert.deepEqual(r.dependencies, ["REQ-003"]);
  });

  it("exits 1 on self-loop", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-001"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /self|cycle/i);
  });

  it("exits 1 on duplicate edge", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-002", "REQ-001"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /duplicate|already/i);
  });

  it("exits 1 on cycle through existing graph", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-002"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /cycle|circular/i);
  });

  it("exits 1 when REQ-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-999", "REQ-001"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when DEP-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001", "REQ-999"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when an arg is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "add", "REQ-001"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(threeReqPrd(), null, 2));
    const result = run(["req", "dep", "add", "REQ-001", "REQ-003", prdPath]);
    assert.equal(result.exitCode, 0, result.stderr);
  });
});
