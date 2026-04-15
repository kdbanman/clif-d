import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { run, withFixture, MINIMAL_PRD } from "./helpers.js";

describe("run helper stdin support", () => {
  it("forwards input option to child stdin without error", () => {
    const dir = withFixture(MINIMAL_PRD);
    const result = run(["req", "ls"], {
      cwd: dir,
      input: '{"ignored": true}',
    });
    assert.equal(result.exitCode, 0);
  });
});
