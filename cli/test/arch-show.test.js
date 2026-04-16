import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArch() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    {
      id: "ARCH-001",
      title: "Bin distribution",
      description: "D",
      level: "context",
    },
  ];
  return prd;
}

describe("arch show", () => {
  it("returns the full architecture object", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "show", "ARCH-001"], { cwd: dir });
    assert.equal(result.exitCode, 0, result.stderr);
    const item = JSON.parse(result.stdout);
    assert.equal(item.level, "context");
    assert.equal(item.id, "ARCH-001");
  });

  it("exits 1 when ARCH-ID not found", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "show", "ARCH-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /ARCH-999/);
  });

  it("exits 2 when no ARCH-ID given", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "show"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithArch(), null, 2));
    const result = run(["arch", "show", "ARCH-001", prdPath]);
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "show", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch show/i);
  });
});
