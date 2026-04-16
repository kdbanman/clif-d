import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { run } from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("schema copy", () => {
  it("copies schema to destination directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const result = run(["schema", "copy", dir]);
    assert.equal(result.exitCode, 0);

    const destFile = path.join(dir, "prd-schema.json");
    assert.ok(fs.existsSync(destFile));

    const canonical = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../skills/create-initial-prd/assets/prd-schema.json",
      ),
      "utf8",
    );
    const copied = fs.readFileSync(destFile, "utf8");
    assert.equal(copied, canonical);

    assert.equal(result.stdout.trim(), destFile);
  });

  it("exits 1 when destination directory does not exist", () => {
    const result = run(["schema", "copy", "/nonexistent/path"]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /directory|exist/i);
  });

  it("exits 2 when no dest-dir argument given", () => {
    const result = run(["schema", "copy"]);
    assert.equal(result.exitCode, 2);
  });

  it("overwrites existing schema file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    fs.writeFileSync(path.join(dir, "prd-schema.json"), "old content");
    const result = run(["schema", "copy", dir]);
    assert.equal(result.exitCode, 0);
    const content = fs.readFileSync(
      path.join(dir, "prd-schema.json"),
      "utf8",
    );
    assert.notEqual(content, "old content");
  });

  it("prints help on --help", () => {
    const result = run(["schema", "copy", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /schema copy/i);
  });
});
