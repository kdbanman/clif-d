import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithContext() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    { id: "CTX-001", title: "A", description: "D", type: "constraint" },
    { id: "CTX-003", title: "B", description: "D", type: "persona" },
  ];
  return prd;
}

describe("ctx ls", () => {
  it("lists all context items as JSON", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 2);
    assert.deepEqual(Object.keys(items[0]), ["id", "title", "type"]);
  });

  it("filters by --type", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--type=persona"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "CTX-003");
  });

  it("outputs tabular with --plain", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^id\t/);
    assert.equal(lines.length, 3);
  });

  it("returns [] when no context items exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["ctx", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });

  it("supports custom --fields", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "ls", "--fields=id,description"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(items[0]), ["id", "description"]);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "ls", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx ls/i);
  });
});
