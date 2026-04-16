import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithContext() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.context = [
    { id: "CTX-001", title: "A", description: "D", type: "constraint" },
    { id: "CTX-003", title: "B", description: "D", type: "persona" },
  ];
  return prd;
}

describe("ctx add", () => {
  it("assigns max+1 (CTX-004) even when gaps exist", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "C", description: "D", type: "domain" };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "CTX-004");
  });

  it("appends a context item and outputs the added object", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "New", description: "D", type: "constraint" };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0);
    const added = JSON.parse(result.stdout);
    assert.equal(added.title, "New");
    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.context.length, 3);
    assert.equal(prd.context[2].title, "New");
  });

  it("outputs fields in schema order", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "T", description: "D", type: "domain" };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0);
    const keys = Object.keys(JSON.parse(result.stdout));
    assert.deepEqual(keys, ["id", "title", "description", "type"]);
  });

  it("exits 1 on invalid type", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "T", description: "D", type: "invalid_type" };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /type/i);
  });

  it("exits 1 when required field missing", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "T", type: "constraint" };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /description/i);
  });

  it("exits 1 on duplicate explicit id", () => {
    const dir = withFixture(prdWithContext());
    const body = {
      id: "CTX-001",
      title: "Dup",
      description: "D",
      type: "domain",
    };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
    const body = { title: "T", description: "D", type: "domain" };
    const result = run(["ctx", "add", prdPath], { input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "add", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx add/i);
  });
});
