import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("req add", () => {
  it("auto-assigns the next REQ-NNN id and appends the requirement", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "New requirement",
      description: "Something new",
      acceptance_criteria: "Done when done",
      abstraction_level: "high",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "REQ-003");
    assert.equal(added.title, "New requirement");

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.requirements.length, 3);
    assert.equal(prd.requirements[2].id, "REQ-003");
  });

  it("accepts an explicit id if it does not collide", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      id: "REQ-042",
      title: "Forty-two",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "low",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
    const added = JSON.parse(result.stdout);
    assert.equal(added.id, "REQ-042");
  });

  it("exits 1 when a required field is missing", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /title/i);

    const prd = JSON.parse(
      fs.readFileSync(path.join(dir, "clif-d", "prd.json"), "utf8"),
    );
    assert.equal(prd.requirements.length, 2);
  });

  it("exits 1 when abstraction_level is invalid", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "medium",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /abstraction/i);
  });

  it("exits 1 when id is malformed", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      id: "BAD-001",
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when id already exists", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      id: "REQ-001",
      title: "Duplicate",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /already|exist/i);
  });

  it("exits 1 on malformed acceptance_criteria object", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "T",
      description: "D",
      acceptance_criteria: { given: "G", when: "W" },
      abstraction_level: "low",
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /acceptance_criteria|then/i);
  });

  it("exits 1 on non-JSON stdin", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "add"], { cwd: dir, input: "not json{" });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 on dangling dependency", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      dependencies: ["REQ-999"],
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("exits 1 on dangling context_ref", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      context_refs: ["CTX-999"],
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
  });

  it("exits 1 when adding a new requirement that depends on itself", () => {
    const dir = withFixture(MINIMAL_PRD);
    const body = {
      id: "REQ-003",
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      dependencies: ["REQ-003"],
    };
    const result = run(["req", "add"], {
      cwd: dir,
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /cycle|self/i);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const body = {
      title: "T",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    };
    const result = run(["req", "add", prdPath], {
      input: JSON.stringify(body),
    });
    assert.equal(result.exitCode, 0, result.stderr);
  });

  it("prints help on --help", () => {
    const result = run(["req", "add", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /req add/i);
  });
});
