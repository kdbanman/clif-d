import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

function prdWithArch() {
  const prd = structuredClone(MINIMAL_PRD);
  prd.architecture = [
    {
      id: "ARCH-001",
      title: "Bin distribution",
      description: "D",
      level: "context",
    },
  ];
  return prd;
}

describe("arch edit", () => {
  it("updates level and preserves other fields", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-001"], {
      cwd: dir,
      input: JSON.stringify({ level: "container" }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
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
    assert.match(result.stderr, /id/i);
  });

  it("exits 1 when the edit invalidates the enum", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-001"], {
      cwd: dir,
      input: JSON.stringify({ level: "subsystem" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /level/i);
  });

  it("exits 1 when ARCH-ID not found", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit", "ARCH-999"], {
      cwd: dir,
      input: JSON.stringify({ level: "container" }),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /ARCH-999/);
  });

  it("exits 2 when no ARCH-ID given", () => {
    const dir = withFixture(prdWithArch());
    const result = run(["arch", "edit"], {
      cwd: dir,
      input: JSON.stringify({ level: "container" }),
    });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithArch(), null, 2));
    const result = run(["arch", "edit", "ARCH-001", prdPath], {
      input: JSON.stringify({ level: "container" }),
    });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "edit", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch edit/i);
  });
});
