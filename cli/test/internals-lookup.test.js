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

const PRD = {
  requirements: [
    { id: "REQ-001", title: "one" },
    { id: "REQ-002", title: "two" },
  ],
};

describe("Lookup.findRequirement", () => {
  it("returns the matching requirement", () => {
    const req = internals.Lookup.findRequirement(PRD, "REQ-002");
    assert.equal(req.title, "two");
  });

  it("returns undefined when not found", () => {
    const req = internals.Lookup.findRequirement(PRD, "REQ-999");
    assert.equal(req, undefined);
  });
});

describe("Lookup.findRequirementOrExit", () => {
  it("returns requirement on hit without invoking exit", () => {
    let exited = false;
    const req = internals.Lookup.findRequirementOrExit(PRD, "REQ-001", {
      exit: () => {
        exited = true;
      },
      stderr: { write() {} },
    });
    assert.equal(req.title, "one");
    assert.equal(exited, false);
  });

  it("calls exit(1) and writes a stable message when not found", () => {
    const exitCodes = [];
    let captured = "";
    internals.Lookup.findRequirementOrExit(PRD, "REQ-999", {
      exit: (c) => exitCodes.push(c),
      stderr: {
        write(s) {
          captured += s;
        },
      },
    });
    assert.deepEqual(exitCodes, [1]);
    assert.match(captured, /REQ-999 not found/);
  });
});
