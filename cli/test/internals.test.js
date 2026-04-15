import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

describe("test-export seam", () => {
  it("exposes sentinel when CLIF_D_TEST_EXPORTS is set", () => {
    process.env.CLIF_D_TEST_EXPORTS = "1";
    try {
      delete require.cache[require.resolve("../clif-d.js")];
      const internals = require("../clif-d.js");
      assert.equal(internals.__testMode, true);
    } finally {
      delete process.env.CLIF_D_TEST_EXPORTS;
      delete require.cache[require.resolve("../clif-d.js")];
    }
  });

  it("does not execute CLI dispatch when required as module", () => {
    process.env.CLIF_D_TEST_EXPORTS = "1";
    try {
      delete require.cache[require.resolve("../clif-d.js")];
      const internals = require("../clif-d.js");
      assert.equal(typeof internals, "object");
    } finally {
      delete process.env.CLIF_D_TEST_EXPORTS;
      delete require.cache[require.resolve("../clif-d.js")];
    }
  });
});
