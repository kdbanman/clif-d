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

describe("Help.renderCommand", () => {
  it("renders a usage line, description, flags, and exit codes", () => {
    const out = internals.Help.renderCommand({
      usage: "clif-d foo <X> [prd-path]",
      description: "Do a foo.",
      flags: [
        { flag: "--bar, -b <val>", description: "The bar." },
      ],
      exitCodes: [
        { code: 0, description: "Success." },
        { code: 1, description: "Bar invalid." },
      ],
    });
    assert.match(out, /Usage: clif-d foo/);
    assert.match(out, /Do a foo\./);
    assert.match(out, /--bar, -b <val>.*The bar\./);
    assert.match(out, /^\s*0\s+Success\./m);
    assert.match(out, /^\s*1\s+Bar invalid\./m);
  });

  it("omits sections when arrays are empty or missing", () => {
    const out = internals.Help.renderCommand({
      usage: "clif-d bare",
      description: "Just a description.",
    });
    assert.match(out, /Usage: clif-d bare/);
    assert.doesNotMatch(out, /Flags:/);
    assert.doesNotMatch(out, /Exit codes:/);
  });
});
