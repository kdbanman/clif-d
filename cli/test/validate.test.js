import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("validate", () => {
  it("returns empty array for a valid PRD", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const issues = JSON.parse(result.stdout);
    assert.deepEqual(issues, []);
  });

  it("detects duplicate requirement IDs", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-001",
      title: "Duplicate",
      description: "Dup",
      acceptance_criteria: "Done",
      abstraction_level: "high",
    });
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const dupIssue = issues.find((i) => i.message.includes("REQ-001"));
    assert.ok(dupIssue);
    assert.equal(dupIssue.level, "error");
  });

  it("detects dangling dependency reference", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[1].dependencies = ["REQ-999"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const refIssue = issues.find(
      (i) => i.message.includes("REQ-999") && i.id === "REQ-002",
    );
    assert.ok(refIssue);
    assert.equal(refIssue.level, "error");
  });

  it("detects dangling context_refs", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].context_refs = ["CTX-999"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const refIssue = issues.find((i) => i.message.includes("CTX-999"));
    assert.ok(refIssue);
  });

  it("detects dangling architecture_refs", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].architecture_refs = ["ARCH-999"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const refIssue = issues.find((i) => i.message.includes("ARCH-999"));
    assert.ok(refIssue);
  });

  it("detects dependency cycles", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].dependencies = ["REQ-002"];
    prd.requirements[1].dependencies = ["REQ-001"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const cycleIssue = issues.find((i) => /cycle|circular/i.test(i.message));
    assert.ok(cycleIssue);
    assert.equal(cycleIssue.level, "error");
  });

  it("handles self-referencing dependency", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].dependencies = ["REQ-001"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const cycleIssue = issues.find((i) => /cycle|circular/i.test(i.message));
    assert.ok(cycleIssue);
  });

  it("detects longer cycles (A -> B -> C -> A)", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements.push({
      id: "REQ-003",
      title: "Third",
      description: "Desc",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      dependencies: ["REQ-001"],
    });
    prd.requirements[0].dependencies = ["REQ-003"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("detects done status without implementation_commit", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const issue = issues.find(
      (i) => i.id === "REQ-001" && /commit/i.test(i.message),
    );
    assert.ok(issue);
    assert.equal(issue.level, "error");
  });

  it("warns when implementation_commit present but status is not done", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].implementation_commit = "abc1234";
    prd.requirements[0].status = "in_progress";
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const issues = JSON.parse(result.stdout);
    const issue = issues.find(
      (i) => i.id === "REQ-001" && i.level === "warning",
    );
    assert.ok(issue);
  });

  it("passes when done status has implementation_commit", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    prd.requirements[0].implementation_commit = "abc1234";
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 0);
  });

  it("detects invalid status value", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "invalid_status";
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const issue = issues.find(
      (i) => i.id === "REQ-001" && /status/i.test(i.message),
    );
    assert.ok(issue);
  });

  it("detects invalid abstraction_level", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].abstraction_level = "medium";
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("detects invalid context type", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.context = [
      { id: "CTX-001", title: "T", description: "D", type: "invalid" },
    ];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("detects invalid architecture level", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.architecture = [
      { id: "ARCH-001", title: "T", description: "D", level: "invalid" },
    ];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("detects missing required fields on requirement", () => {
    const prd = structuredClone(MINIMAL_PRD);
    delete prd.requirements[0].title;
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    const issue = issues.find(
      (i) => i.id === "REQ-001" && /title/i.test(i.message),
    );
    assert.ok(issue);
  });

  it("detects missing required fields on context item", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.context = [{ id: "CTX-001", description: "D", type: "constraint" }];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
  });

  it("reports multiple issues at once", () => {
    const prd = structuredClone(MINIMAL_PRD);
    prd.requirements[0].status = "done";
    prd.requirements[1].dependencies = ["REQ-999"];
    const dir = withFixture(prd);
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    const issues = JSON.parse(result.stdout);
    assert.ok(issues.length >= 2);
  });

  it("exits 2 when PRD file not found", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const result = run(["validate"], { cwd: dir });
    assert.equal(result.exitCode, 2);
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(MINIMAL_PRD, null, 2));
    const result = run(["validate", prdPath]);
    assert.equal(result.exitCode, 0);
  });

  it("prints help on --help", () => {
    const result = run(["validate", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /validate/i);
  });
});
