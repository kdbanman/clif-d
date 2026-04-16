import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArch() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "Bin distribution", description: "D", level: "context" },
    { id: "ARCH-002", title: "Command router", description: "D", level: "container" },
  ];
  return prd;
}

describe("arch add", () => {
  it("appends and auto-assigns ARCH-003", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "Read-validate-write", description: "D", level: "component" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "ARCH-003");
  });

  it("exits 1 on invalid level", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "T", description: "D", level: "subsystem" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /level/i);
  });

  it("exits 1 when required field missing", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "T", level: "context" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /description/i);
  });

  it("exits 1 on duplicate explicit id", () => {
    const dir = withFixture(prdWithArch());
    const body = { id: "ARCH-001", title: "Dup", description: "D", level: "context" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 1);
  });

  it("outputs fields in schema order", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "T", description: "D", level: "component" };
    const result = run(["arch", "add"], { cwd: dir, input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
    const keys = Object.keys(JSON.parse(result.stdout));
    assert.deepEqual(keys, ["id", "title", "description", "level"]);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithArch(), null, 2));
    const body = { title: "T", description: "D", level: "context" };
    const result = run(["arch", "add", prdPath], { input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "add", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch add/i);
  });
});
