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
    {
      id: "ARCH-002",
      title: "Command router",
      description: "D",
      level: "container",
    },
  ];
  return prd;
}

describe("arch add", () => {
  it("appends and auto-assigns ARCH-003", () => {
    const dir = withFixture(prdWithArch());
    const body = {
      title: "Read-validate-write",
      description: "D",
      level: "component",
    };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "ARCH-003");
    assert.equal(added.level, "component");
  });

  it("persists new arch item with optional diagram_file", () => {
    const dir = withFixture(prdWithArch());
    const body = {
      title: "Diagram carrier",
      description: "D",
      level: "container",
      diagram_file: "architecture/overview.mmd",
    };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.architecture[2].diagram_file, "architecture/overview.mmd");
  });

  it("exits 1 on invalid level", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "T", description: "D", level: "subsystem" };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /level/i);
  });

  it("exits 1 when required field missing", () => {
    const dir = withFixture(prdWithArch());
    const body = { title: "T", level: "component" };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /description/i);
  });

  it("exits 1 on malformed id", () => {
    const dir = withFixture(prdWithArch());
    const body = {
      id: "BAD-001",
      title: "T",
      description: "D",
      level: "component",
    };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /ARCH-NNN/);
  });

  it("exits 1 on duplicate id", () => {
    const dir = withFixture(prdWithArch());
    const body = {
      id: "ARCH-001",
      title: "Dup",
      description: "D",
      level: "component",
    };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when diagram_file is not a string", () => {
    const dir = withFixture(prdWithArch());
    const body = {
      title: "T",
      description: "D",
      level: "component",
      diagram_file: 42,
    };
    const result = run(["arch", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /diagram_file/);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(prdWithArch(), null, 2));
    const body = { title: "T", description: "D", level: "component" };
    const result = run(["arch", "add", prdPath], {
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["arch", "add", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /arch add/i);
  });
});
