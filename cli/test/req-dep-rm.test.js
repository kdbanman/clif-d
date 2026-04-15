import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req dep rm", () => {
  it("removes an existing edge and persists the change", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-002", "REQ-001"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const updated = JSON.parse(result.stdout);
    assert.deepEqual(updated.dependencies, []);
    const disk = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    const r = disk.requirements.find(
      (/** @type {{ id: string }} */ x) => x.id === "REQ-002",
    );
    assert.deepEqual(r.dependencies, []);
  });

  it("exits 1 when edge is not present", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-001", "REQ-002"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /not present|no edge|not a dependency/i);
  });

  it("exits 1 when REQ-ID not found", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-999", "REQ-001"], {
      cwd: dir,
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 2 when a required arg is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "dep", "rm", "REQ-002"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["req", "dep", "rm", "REQ-002", "REQ-001", prdPath]);
    assert.equal(result.exitCode, 0, result.stderr);
  });
});
