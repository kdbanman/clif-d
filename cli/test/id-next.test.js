import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("id next", () => {
  it("returns next REQ ID", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "REQ"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "REQ-003");
  });

  it("returns CTX-001 when no context items exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "CTX"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "CTX-001");
  });

  it("returns next ARCH ID", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.architecture = [
      { id: "ARCH-001", title: "T", description: "D", level: "context" },
      { id: "ARCH-003", title: "T", description: "D", level: "context" },
    ];
    const dir = withFixture(prd);
    const result = run(["id", "next", "ARCH"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "ARCH-004");
  });

  it("exits 1 for invalid prefix", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next", "INVALID"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /prefix|REQ|CTX|ARCH/i);
  });

  it("exits 2 when no prefix argument given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["id", "next"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("handles gaps in ID numbering", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-010",
      title: "Tenth",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
    });
    const dir = withFixture(prd);
    const result = run(["id", "next", "REQ"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "REQ-011");
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "my.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["id", "next", "REQ", prdPath]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "REQ-003");
  });

  it("prints help on --help", () => {
    const result = run(["id", "next", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /id next/i);
  });
});
