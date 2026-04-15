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

describe("selectBestCandidate", () => {
  it("returns null on empty input", () => {
    assert.equal(internals.selectBestCandidate([]), null);
  });

  it("returns the sole candidate", () => {
    const r = { id: "REQ-001", priority: 5 };
    assert.equal(internals.selectBestCandidate([r]), r);
  });

  it("returns the lowest priority value (1 beats 5)", () => {
    const a = { id: "REQ-001", priority: 5 };
    const b = { id: "REQ-002", priority: 1 };
    assert.equal(internals.selectBestCandidate([a, b]).id, "REQ-002");
  });

  it("prefers defined priority over undefined", () => {
    const a = { id: "REQ-001" };
    const b = { id: "REQ-002", priority: 3 };
    assert.equal(internals.selectBestCandidate([a, b]).id, "REQ-002");
  });

  it("returns first by insertion order when all priorities are undefined", () => {
    const a = { id: "REQ-001" };
    const b = { id: "REQ-002" };
    assert.equal(internals.selectBestCandidate([a, b]).id, "REQ-001");
  });
});
