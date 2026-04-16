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

describe("ctx show", () => {
  it("returns the full context object", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-001"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const item = JSON.parse(result.stdout);
    assert.equal(item.id, "CTX-001");
    assert.equal(item.title, "A");
    assert.equal(item.type, "constraint");
  });

  it("exits 1 when CTX-ID not found", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /CTX-999/);
  });

  it("exits 2 when no CTX-ID given", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "show", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx show/i);
  });
});
