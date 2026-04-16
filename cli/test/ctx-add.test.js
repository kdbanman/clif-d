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
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "CTX-004");
  });

  it("appends a context item and outputs the added object", () => {
    const dir = withFixture(prdWithContext());
    const body = {
      title: "New",
      description: "D",
      type: "constraint",
      reference_link: "https://example.com",
    };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.title, "New");
    assert.equal(added.reference_link, "https://example.com");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.context.length, 3);
    assert.equal(prd.context[2].title, "New");
  });

  it("accepts an explicit id if it does not collide", () => {
    const dir = withFixture(prdWithContext());
    const body = {
      id: "CTX-042",
      title: "Forty-two",
      description: "D",
      type: "domain",
    };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "CTX-042");
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

  it("exits 1 when required field is missing", () => {
    const dir = withFixture(prdWithContext());
    const body = { title: "T", type: "constraint" }; // no description
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /description/i);
  });

  it("exits 1 when id is malformed", () => {
    const dir = withFixture(prdWithContext());
    const body = {
      id: "BAD-001",
      title: "T",
      description: "D",
      type: "domain",
    };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /CTX-NNN/i);
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
    assert.match(result.stderr, /exist/i);
  });

  it("exits 1 on non-object stdin", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "add"], { cwd: dir, input: "[1,2,3]" });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 on non-JSON stdin", () => {
    const dir = withFixture(prdWithContext());
    const result = run(["ctx", "add"], { cwd: dir, input: "not json{" });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when reference_link is not a string", () => {
    const dir = withFixture(prdWithContext());
    const body = {
      title: "T",
      description: "D",
      type: "domain",
      reference_link: 123,
    };
    const result = run(["ctx", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /reference_link/);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithContext(), null, 2));
    const body = { title: "T", description: "D", type: "domain" };
    const result = run(["ctx", "add", prdPath], { input: JSON.stringify(body) });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["ctx", "add", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /ctx add/i);
  });
});
