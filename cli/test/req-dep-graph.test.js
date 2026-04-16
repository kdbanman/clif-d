import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, withFixture } from "./helpers.js";

const GRAPH_PRD = {
  $schema: "prd-schema.json",
  product_name: "test",
  concept_summary: { description: "test", reference_link: "test" },
  context: [],
  architecture: [],
  requirements: [
    {
      id: "REQ-001",
      title: "First",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
    },
    {
      id: "REQ-002",
      title: "Second",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
      dependencies: ["REQ-001"],
    },
    {
      id: "REQ-003",
      title: "Third",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
      dependencies: ["REQ-001", "REQ-002"],
    },
    {
      id: "REQ-004",
      title: "Fourth",
      description: "D",
      acceptance_criteria: "Done",
      abstraction_level: "high",
      status: "not_started",
    },
  ],
};

describe("req dep graph", () => {
  it("outputs full adjacency list as JSON", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(graph["REQ-001"], []);
    assert.deepEqual(graph["REQ-002"], ["REQ-001"]);
    assert.deepEqual(graph["REQ-003"], ["REQ-001", "REQ-002"]);
    assert.deepEqual(graph["REQ-004"], []);
  });

  it("includes all requirements even those with no dependencies", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph"], { cwd: dir });
    const graph = JSON.parse(result.stdout);
    assert.ok("REQ-004" in graph);
  });

  it("outputs ancestor subgraph with --root", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph", "--root=REQ-003"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const graph = JSON.parse(result.stdout);
    assert.ok("REQ-003" in graph);
    assert.ok("REQ-002" in graph);
    assert.ok("REQ-001" in graph);
    assert.ok(!("REQ-004" in graph));
  });

  it("exits 1 when --root ID does not exist", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph", "--root=REQ-999"], { cwd: dir });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /REQ-999/);
  });

  it("outputs single-node graph when root has no dependencies", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph", "--root=REQ-004"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(graph), ["REQ-004"]);
    assert.deepEqual(graph["REQ-004"], []);
  });

  it("outputs plain text with --plain", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const lines = result.stdout.trimEnd().split("\n");
    assert.ok(lines.some((l) => l === "REQ-002 -> REQ-001"));
    assert.ok(lines.some((l) => l === "REQ-003 -> REQ-001"));
    assert.ok(lines.some((l) => l === "REQ-003 -> REQ-002"));
  });

  it("outputs DOT format with --dot", () => {
    const dir = withFixture(GRAPH_PRD);
    const result = run(["req", "dep", "graph", "--dot"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /digraph/);
    assert.match(result.stdout, /"REQ-002" -> "REQ-001"/);
  });

  it("plain output is empty when no edges exist", () => {
    const prd = structuredClone(GRAPH_PRD);
    prd.requirements = [prd.requirements[0], prd.requirements[3]];
    const dir = withFixture(prd);
    const result = run(["req", "dep", "graph", "--plain"], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trimEnd(), "");
  });

  it("accepts explicit prd-path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
    const prdPath = path.join(dir, "custom.json");
    fs.writeFileSync(prdPath, JSON.stringify(GRAPH_PRD, null, 2));
    const result = run(["req", "dep", "graph", prdPath]);
    assert.equal(result.exitCode, 0);
  });

  it("prints help on --help", () => {
    const result = run(["req", "dep", "graph", "--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stderr, /req dep graph/i);
  });
});
