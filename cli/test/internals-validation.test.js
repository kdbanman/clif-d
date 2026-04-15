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

function build(overrides = {}) {
  return {
    requirements: [],
    context: [],
    architecture: [],
    ...overrides,
  };
}

describe("Validation.all", () => {
  it("returns an empty list for a valid minimal PRD", () => {
    const prd = build({
      requirements: [
        {
          id: "REQ-001",
          title: "t",
          description: "d",
          acceptance_criteria: "ac",
          abstraction_level: "high",
        },
      ],
    });
    const issues = internals.Validation.all(prd);
    assert.deepEqual(issues, []);
  });

  it("flags duplicate REQ IDs", () => {
    const reqTemplate = {
      title: "t",
      description: "d",
      acceptance_criteria: "ac",
      abstraction_level: "high",
    };
    const prd = build({
      requirements: [
        { id: "REQ-001", ...reqTemplate },
        { id: "REQ-001", ...reqTemplate },
      ],
    });
    const issues = internals.Validation.all(prd);
    const dup = issues.find((i) => /Duplicate REQ/.test(i.message));
    assert.ok(dup, `expected duplicate REQ issue; got ${JSON.stringify(issues)}`);
    assert.equal(dup.level, "error");
  });

  it("flags dependency cycles", () => {
    const prd = build({
      requirements: [
        {
          id: "REQ-001",
          title: "t",
          description: "d",
          acceptance_criteria: "ac",
          abstraction_level: "high",
          dependencies: ["REQ-002"],
        },
        {
          id: "REQ-002",
          title: "t",
          description: "d",
          acceptance_criteria: "ac",
          abstraction_level: "high",
          dependencies: ["REQ-001"],
        },
      ],
    });
    const issues = internals.Validation.all(prd);
    assert.ok(issues.some((i) => /cycle/i.test(i.message)));
  });

  it("flags dangling dependency references", () => {
    const prd = build({
      requirements: [
        {
          id: "REQ-001",
          title: "t",
          description: "d",
          acceptance_criteria: "ac",
          abstraction_level: "high",
          dependencies: ["REQ-999"],
        },
      ],
    });
    const issues = internals.Validation.all(prd);
    assert.ok(issues.some((i) => /Dangling dependency/.test(i.message)));
  });

  it("flags missing required fields", () => {
    const prd = build({
      requirements: [{ id: "REQ-001" }],
    });
    const issues = internals.Validation.all(prd);
    assert.ok(issues.some((i) => /Missing required/.test(i.message)));
  });

  it("flags done without implementation_commit", () => {
    const prd = build({
      requirements: [
        {
          id: "REQ-001",
          title: "t",
          description: "d",
          acceptance_criteria: "ac",
          abstraction_level: "high",
          status: "done",
        },
      ],
    });
    const issues = internals.Validation.all(prd);
    assert.ok(
      issues.some((i) => /implementation_commit/.test(i.message) && i.level === "error"),
    );
  });
});
