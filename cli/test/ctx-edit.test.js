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
    assert.equal(result.exitCode, 0, result.stderr);
    const item = JSON.parse(result.stdout);
    assert.equal(item.title, "Renamed");
    assert.equal(item.type, "constraint");
    assert.equal(item.description, "D");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.context[0].title, "Renamed");
  });

  it("exits 1 when stdin contains an id field", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: JSON.stringify({ id: "CTX-999" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /id/i);
  });

  it("exits 1 when the edit invalidates the enum", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: JSON.stringify({ type: "invalid" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /type/i);
  });

  it("exits 1 when CTX-ID not found", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-999"], {
      cwd: dir,
      input: JSON.stringify({ title: "x" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /CTX-999/);
  });

  it("exits 1 on non-object stdin", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit", "CTX-001"], {
      cwd: dir,
      input: "[1,2,3]",
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when no CTX-ID given", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "edit"], {
      cwd: dir,
      input: JSON.stringify({ title: "x" }),
    });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
    const result = run(["ctx", "edit", "CTX-001", prdPath], {
      input: JSON.stringify({ title: "Renamed" }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "edit", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx edit/i);
  });
});
