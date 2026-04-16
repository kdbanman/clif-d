import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** @type {any} */
let internals;

before(() => {
  process.env.CLIF_D_TEST_EXPORTS = "1";
  delete require.cache[require.resolve("../clif-d.js")];
  internals = require("../clif-d.js");
});

after(() => {
  delete process.env.CLIF_D_TEST_EXPORTS;
  delete require.cache[require.resolve("../clif-d.js")];
});

const REQS = [
  { id: "REQ-001", title: "A", status: "done", abstraction_level: "high", priority: 3 },
  { id: "REQ-002", title: "B", status: "not_started", abstraction_level: "low", priority: 1 },
  { id: "REQ-003", title: "C", status: "in_progress", abstraction_level: "low" },
  { id: "REQ-004", title: "D", status: "blocked", abstraction_level: "high", priority: 2 },
];

describe("Filters.byStatus", () => {
  it("matches the requested statuses", () => {
    const filtered = internals.Filters.byStatus(REQS, new Set(["not_started"]));
    assert.deepEqual(filtered.map((r) => r.id), ["REQ-002"]);
  });
  it("matches exact status values", () => {
    const filtered = internals.Filters.byStatus(REQS, new Set(["done", "blocked"]));
    assert.deepEqual(filtered.map((r) => r.id), ["REQ-001", "REQ-004"]);
  });
});

describe("Filters.byAbstraction", () => {
  it("filters by abstraction_level", () => {
    const filtered = internals.Filters.byAbstraction(REQS, "low");
    assert.deepEqual(filtered.map((r) => r.id), ["REQ-002", "REQ-003"]);
  });
});

describe("Sort.byPriority", () => {
  it("sorts ascending and puts undefined priority last", () => {
    const sorted = internals.Sort.byPriority(REQS);
    assert.deepEqual(sorted.map((r) => r.id), [
      "REQ-002", // priority 1
      "REQ-004", // priority 2
      "REQ-001", // priority 3
      "REQ-003", // undefined
    ]);
  });
  it("does not mutate input", () => {
    const copy = [...REQS];
    internals.Sort.byPriority(REQS);
    assert.deepEqual(REQS, copy);
  });
});

describe("Projection.selectFields", () => {
  it("returns the requested fields verbatim", () => {
    const projected = internals.Projection.selectFields(REQS[0], [
      "id",
      "title",
      "status",
    ]);
    assert.deepEqual(projected, {
      id: "REQ-001",
      title: "A",
      status: "done",
    });
  });
  it("omits status when absent from the input (validation owns presence)", () => {
    const projected = internals.Projection.selectFields(
      { id: "REQ-099", title: "X" },
      ["id", "status"],
    );
    assert.deepEqual(projected, { id: "REQ-099" });
  });
});

describe("Format.toPlain", () => {
  it("produces tab-separated header and rows", () => {
    const reqs = [{ id: "REQ-001", title: "A", status: "done" }];
    const out = internals.Format.toPlain(reqs, ["id", "title", "status"]);
    assert.equal(out, "id\ttitle\tstatus\nREQ-001\tA\tdone\n");
  });
  it("serializes object fields as JSON", () => {
    const reqs = [{ id: "REQ-001", acceptance_criteria: { given: "g", when: "w", then: "t" } }];
    const out = internals.Format.toPlain(reqs, ["id", "acceptance_criteria"]);
    assert.match(out, /"given":"g"/);
  });
});
