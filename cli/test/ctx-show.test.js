import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithContext() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    {
      id: "CTX-001",
      title: "A",
      description: "D",
      type: "constraint",
      reference_link: "https://example.com",
    },
    { id: "CTX-002", title: "B", description: "D", type: "persona" },
  ];
  return prd;
}

describe("ctx show", () => {
  it("returns the full context object in schema order", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-001"], { cwd: dir });
    assert.equal(result.exitCode, 0, result.stderr);
    const item = JSON.parse(result.stdout);
    assert.equal(item.id, "CTX-001");
    assert.equal(item.title, "A");
    assert.equal(item.type, "constraint");
    assert.equal(item.reference_link, "https://example.com");
    assert.deepEqual(Object.keys(item), [
      "id",
      "title",
      "description",
      "type",
      "reference_link",
    ]);
  });

  it("omits absent optional fields", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "show", "CTX-002"], { cwd: dir });
    const item = JSON.parse(result.stdout);
    assert.equal(item.reference_link, undefined);
    assert.ok(!("reference_link" in item));
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

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
    const result = run(["ctx", "show", "CTX-001", prdPath]);
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "show", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx show/i);
  });
});
