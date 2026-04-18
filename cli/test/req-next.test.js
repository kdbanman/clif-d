import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture } from "./helpers.js";

const NEXT_PRD = {
  $schema: "prd-schema.json",
  product_name: "test",
  concept_summary: { description: "test", reference_link: "test" },
  context: [],
  architecture: [],
  requirements: [
    {
      id: "REQ-001",
      title: "First",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      priority: 1,
      status: "done",
      implementation_commit: "abc1234",
    },
    {
      id: "REQ-002",
      title: "Second",
      description: "D",
      acceptance_criteria: { given: "G", when: "W", then: "T" },
      abstraction_level: "low",
      status: "not_started",
      priority: 1,
      dependencies: ["REQ-001"],
    },
    {
      id: "REQ-003",
      title: "Third",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
      priority: 2,
    },
  ],
};

describe("req next", () => {
  it("returns highest-priority eligible requirement with full object", () => {
    const dir = withFixture(NEXT_PRD);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
    assert.equal(req.description, "D");
    assert.deepEqual(req.acceptance_criteria, {
      given: "G",
      when: "W",
      then: "T",
    });
    assert.deepEqual(req.dependencies, ["REQ-001"]);
    assert.equal(req.status, "not_started");
  });

  it("prefers lower priority number among eligible", () => {
    const prd = structuredClone(NEXT_PRD);
    delete prd.requirements[1].dependencies;
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
  });

  it("prefers requirements with priority over those without", () => {
    const prd = structuredClone(NEXT_PRD);
    delete prd.requirements[1].dependencies;
    delete prd.requirements[2].priority;
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
  });

  it("breaks priority ties by PRD order (stable)", () => {
    const prd = structuredClone(NEXT_PRD);
    delete prd.requirements[1].dependencies;
    prd.requirements[2].priority = 1;
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
  });

  it("skips requirement whose dependency is not done", () => {
    const prd = structuredClone(NEXT_PRD);
    prd.requirements[0].status = "in_progress";
    delete prd.requirements[0].implementation_commit;
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-003");
  });

  it("refuses to run against a PRD with a dangling dependency (REQ-029)", () => {
    const prd = structuredClone(NEXT_PRD);
    prd.requirements[1].dependencies = ["REQ-999"];
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Dangling dependency/);
  });

  it("handles multi-dep requirements (all must be done)", () => {
    const prd = structuredClone(NEXT_PRD);
    prd.requirements[1].dependencies = ["REQ-001", "REQ-003"];
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-003");
  });

  it("exits 1 with a diagnostic when no requirement is eligible", () => {
    const prd = structuredClone(NEXT_PRD);
    for (const r of prd.requirements) {
      r.status = "done";
      r.implementation_commit = "abc1234";
    }
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /no eligible|no requirement/i);
  });

  it("exits 1 when all not_started requirements are blocked by unmet deps", () => {
    const prd = structuredClone(NEXT_PRD);
    prd.requirements[0].status = "in_progress";
    delete prd.requirements[0].implementation_commit;
    prd.requirements[2].status = "blocked";
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 on an empty requirements array", () => {
    const prd = structuredClone(NEXT_PRD);
    prd.requirements = [];
    const dir = withFixture(prd);
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(NEXT_PRD, null, 2));
    const result = run(["req", "next", prdPath]);
    assert.equal(result.exitCode, 0);
    const req = JSON.parse(result.stdout);
    assert.equal(req.id, "REQ-002");
  });

  it("prints help on --help", () => {
    const result = run(["req", "next", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /req next/i);
  });

  it("exits 2 when PRD file is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const result = run(["req", "next"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /not found/i);
  });
});
