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

describe("ctx edit", () => {
  it("updates title and preserves other fields", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: JSON.stringify({ title: "Renamed" }),
    });
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.title, "Renamed");
    assert.equal(item.type, "constraint");
  });

  it("exits 1 when stdin contains an id field", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: JSON.stringify({ id: "CTX-999" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when the edit invalidates the enum", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: JSON.stringify({ type: "invalid" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when CTX-ID not found", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-999"], {
      cwd: dir,
      input: JSON.stringify({ title: "x" }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "edit", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx edit/i);
  });
});
