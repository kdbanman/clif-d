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

describe("arch edit", () => {
  it("updates level", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-001"], {
      cwd: dir,
      input: JSON.stringify({ level: "container" }),
    });
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.level, "container");
    assert.equal(item.title, "Bin distribution");
  });

  it("exits 1 when stdin contains an id field", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-001"], {
      cwd: dir,
      input: JSON.stringify({ id: "ARCH-999" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when the edit invalidates the enum", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-001"], {
      cwd: dir,
      input: JSON.stringify({ level: "invalid" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when ARCH-ID not found", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-999"], {
      cwd: dir,
      input: JSON.stringify({ title: "x" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "edit", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch edit/i);
  });
});
