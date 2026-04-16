import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithContext() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    { id: "CTX-001", title: "A", description: "D", type: "constraint" },
    { id: "CTX-002", title: "B", description: "D", type: "persona" },
    { id: "CTX-003", title: "C", description: "D", type: "constraint" },
  ];
  return prd;
}

describe("ctx ls", () => {
  it("lists all context items as JSON with default fields", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0, result.stderr);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 3);
    assert.deepEqual(Object.keys(items[0]), ["id", "title", "type"]);
  });

  it("filters by --type", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--type=persona"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "CTX-002");
  });

  it("filters by multiple --type values (comma-separated)", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--type=constraint,persona"], {
      cwd: dir,
    });
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 3);
  });

  it("outputs tabular with --plain", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^id\ttitle\ttype$/);
    assert.equal(lines.length, 4); // header + 3
  });

  it("respects --fields override", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--fields=id,description"], { cwd: dir });
    const items = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(items[0]), ["id", "description"]);
  });

  it("returns [] when no context items exist", () => {
    const dir = withFixture(MINIMAL_PRD); // context: []
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
    const result = run(["ctx", "ls", prdPath]);
    assert.equal(result.exitCode, 0, result.stderr);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 3);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "ls", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx ls/i);
  });
});
