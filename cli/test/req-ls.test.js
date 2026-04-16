import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req ls", () => {
  it("lists all requirements with default fields", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 2);
    const fields = Object.keys(reqs[0]);
    assert.deepEqual(fields, [
      "id",
      "title",
      "priority",
      "abstraction_level",
      "status",
    ]);
    assert.equal(reqs[0].status, "not_started");
  });

  it("filters by --status=done", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--status=done"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, "REQ-002");
  });

  it("filters by --status with comma-separated values", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--status=not_started,done"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 2);
  });

  it("filters by -s shorthand", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "-s", "done"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 1);
  });

  it("filters by --abstraction=low", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--abstraction=low"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, "REQ-002");
  });

  it("sorts by --priority ascending, unranked last", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-003",
      title: "Third",
      description: "Desc",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
    });
    const dir = withFixture(prd);
    const result = run(["req", "ls", "--priority"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs[0].id, "REQ-001");
    assert.equal(reqs[1].id, "REQ-002");
    assert.equal(reqs[2].id, "REQ-003");
  });

  it("combines --status and --abstraction filters", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(
      ["req", "ls", "--status=not_started", "--abstraction=high"],
      { cwd: dir },
    );
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0].id, "REQ-001");
  });

  it("selects custom fields with --fields", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--fields=id,description"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(reqs[0]), ["id", "description"]);
  });

  it("includes dependencies with --deps", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--deps"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    const req2 = reqs.find(
      (/** @type {{ id: string }} */ r) => r.id === "REQ-002",
    );
    assert.deepEqual(req2.dependencies, ["REQ-001"]);
  });

  it("outputs plain tabular text with --plain", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^id\t/);
    assert.equal(lines.length, 3);
    assert.match(lines[1], /^REQ-001\t/);
  });

  it("exits 2 when PRD file not found", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const result = run(["req", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /not found/i);
  });

  it("exits 2 when PRD is invalid JSON", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const cliDir = path.join(dir, "clif-d");
    fs.mkdirSync(cliDir);
    fs.writeFileSync(path.join(cliDir, "prd.json"), "not json{{{");
    const result = run(["req", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /parse|json/i);
  });

  it("accepts explicit prd-path as last argument", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["req", "ls", prdPath]);
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.equal(reqs.length, 2);
  });

  it("returns empty array when no requirements match filter", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls", "--status=blocked"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const reqs = JSON.parse(result.stdout);
    assert.deepEqual(reqs, []);
  });

  it("prints help on req ls --help", () => {
    const result = run(["req", "ls", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /--status/);
    assert.match(result.stderr, /--abstraction/);
  });
});
