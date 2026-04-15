import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArchRefs() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    { id: "ARCH-001", title: "A", description: "D", level: "context" },
    { id: "ARCH-002", title: "B", description: "D", level: "container" },
  ];
  prd.requirements[0].architecture_refs = ["ARCH-001"];
  return prd;
}

describe("req edit", () => {
  it("replaces architecture_refs and preserves other fields", () => {
    const dir = withFixture(prdWithArchRefs());
    const result = run(["req", "edit", "REQ-001"], {
      cwd: dir,
      input: JSON.stringify({ architecture_refs: ["ARCH-001", "ARCH-002"] }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const req = JSON.parse(result.stdout);
    assert.deepEqual(req.architecture_refs, ["ARCH-001", "ARCH-002"]);
    assert.equal(req.title, "First requirement");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = prd.requirements.find(
      (/** @type {{ id: string }} */ x) => x.id === "REQ-001",
    );
    assert.deepEqual(r.architecture_refs, ["ARCH-001", "ARCH-002"]);
  });

  it("can update a scalar field (title)", () => {
    const dir = withFixture(prdWithArchRefs());
    const result = run(["req", "edit", "REQ-001"], {
      cwd: dir,
      input: JSON.stringify({ title: "Renamed" }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const req = JSON.parse(result.stdout);
    assert.equal(req.title, "Renamed");
  });

  it("exits 1 when REQ-ID does not exist", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "edit", "REQ-999"], {
      cwd: dir,
      input: JSON.stringify({ title: "x" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("exits 1 when stdin contains an id field", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "edit", "REQ-001"], {
      cwd: dir,
      input: JSON.stringify({ id: "REQ-999" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /id/i);
  });

  it("exits 1 when edit introduces a cycle", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "edit", "REQ-001"], {
      cwd: dir,
      input: JSON.stringify({ dependencies: ["REQ-002"] }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /cycle|circular/i);
  });

  it("exits 1 when edit introduces a dangling dependency", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "edit", "REQ-001"], {
      cwd: dir,
      input: JSON.stringify({ dependencies: ["REQ-999"] }),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when no REQ-ID argument is given", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "edit"], { cwd: dir, input: "{}" });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["req", "edit", "REQ-001", prdPath], {
      input: JSON.stringify({ title: "New" }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["req", "edit", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /req edit/i);
  });
});
