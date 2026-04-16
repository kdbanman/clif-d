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

describe("arch show", () => {
  it("returns full object", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "show", "ARCH-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.id, "ARCH-001");
    assert.equal(item.level, "context");
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

  it("prints help on --help", () => {
    const result = run(["arch", "show", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch show/i);
  });
});
