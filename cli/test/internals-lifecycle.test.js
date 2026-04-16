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

const NON_TERMINAL = ["not_started", "in_progress", "blocked"];

describe("Lifecycle.canStart", () => {
  for (const s of NON_TERMINAL) {
    it(`allows start from ${String(s)}`, () => {
      assert.equal(internals.Lifecycle.canStart(s).ok, true);
    });
  }
  it("rejects start from done", () => {
    const r = internals.Lifecycle.canStart("done");
    assert.equal(r.ok, false);
    assert.match(r.reason, /done/);
  });
});

describe("Lifecycle.canComplete", () => {
  for (const s of NON_TERMINAL) {
    it(`allows complete from ${String(s)}`, () => {
      assert.equal(internals.Lifecycle.canComplete(s).ok, true);
    });
  }
  it("rejects complete from done (already done is terminal)", () => {
    const r = internals.Lifecycle.canComplete("done");
    assert.equal(r.ok, false);
    assert.match(r.reason, /done/);
  });
});

describe("Lifecycle.canBlock", () => {
  for (const s of NON_TERMINAL) {
    it(`allows block from ${String(s)}`, () => {
      assert.equal(internals.Lifecycle.canBlock(s).ok, true);
    });
  }
  it("rejects block from done", () => {
    const r = internals.Lifecycle.canBlock("done");
    assert.equal(r.ok, false);
    assert.match(r.reason, /done/);
  });
});
