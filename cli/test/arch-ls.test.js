import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArch() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "Bin distribution", description: "D", level: "context" },
    { id: "ARCH-002", title: "Command router", description: "D", level: "container" },
  ];
  return prd;
}

describe("arch ls", () => {
  it("lists all architecture items as JSON", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 2);
    assert.deepEqual(Object.keys(items[0]), ["id", "title", "level"]);
  });

  it("filters by --level", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "ls", "--level=container"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const items = JSON.parse(result.stdout);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "ARCH-002");
  });

  it("outputs tabular with --plain", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "ls", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^id\t/);
    assert.equal(lines.length, 3);
  });

  it("returns [] when no architecture items exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["arch", "ls"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(JSON.parse(result.stdout), []);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "ls", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch ls/i);
  });
});
