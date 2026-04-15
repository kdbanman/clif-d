// Verifies the ESLint function-size, complexity, and max-depth gates fire
// on minimal violating fixtures and pass on minimal compliant ones. Each
// case writes a tiny `clif-d.js` fixture into a per-test directory under
// `cli/test/.fixtures/` (inside the ESLint config's base path so flat-config
// `files` matchers apply), runs `npx eslint` against it with the project
// config, and checks exit code + rule name in output.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const FIXTURES_ROOT = path.join(__dirname, ".fixtures-backpressure-lint");

after(() => {
  if (fs.existsSync(FIXTURES_ROOT)) {
    fs.rmSync(FIXTURES_ROOT, { recursive: true, force: true });
  }
});

/**
 * Lint a fixture file using the project ESLint config. Returns the exit
 * code and the merged stdout+stderr.
 * @param {string} target
 * @returns {{ exitCode: number, output: string }}
 */
function runEslint(target) {
  const result = spawnSync(
    "npx",
    [
      "eslint",
      "--config",
      path.join(CLI_DIR, "eslint.config.js"),
      "--no-warn-ignored",
      target,
    ],
    {
      cwd: CLI_DIR,
      encoding: "utf8",
      timeout: 30000,
    },
  );
  return {
    exitCode: result.status ?? 1,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

/**
 * Run an arbitrary npm script in CLI_DIR with extra positional args.
 * @param {string} script
 * @param {string[]} extraArgs
 * @returns {{ exitCode: number, output: string }}
 */
function runNpmScript(script, extraArgs) {
  const result = spawnSync(
    "npm",
    ["run", "--silent", script, "--", ...extraArgs],
    {
      cwd: CLI_DIR,
      encoding: "utf8",
      timeout: 60000,
    },
  );
  return {
    exitCode: result.status ?? 1,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

let fixtureCounter = 0;
/**
 * Write `content` to `cli/test/.fixtures-.../<n>/clif-d.js`. The path is
 * inside the ESLint config's base directory so the `files: ["**\/clif-d.js"]`
 * override applies and the function-size/complexity/depth rules are in scope.
 * @param {string} content
 * @returns {string}
 */
function writeAsClifD(content) {
  fs.mkdirSync(FIXTURES_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(FIXTURES_ROOT, `case-`));
  void fixtureCounter++;
  const target = path.join(dir, "clif-d.js");
  fs.writeFileSync(target, content);
  return target;
}

describe("Backpressure: function-size gate", () => {
  it("flags a function whose body exceeds max-lines-per-function", () => {
    // 200 lines of trivial body -- well over our 115 threshold.
    const body = Array.from(
      { length: 200 },
      (_, i) => `  const x${i} = ${i};`,
    ).join("\n");
    const target = writeAsClifD(
      `function tooLong() {\n${body}\n}\nmodule.exports = { tooLong };\n`,
    );
    const { exitCode, output } = runEslint(target);
    assert.notEqual(exitCode, 0);
    assert.match(output, /max-lines-per-function/);
  });

  it("accepts a small compliant function", () => {
    const target = writeAsClifD(
      "function ok() {\n  return 1;\n}\nmodule.exports = { ok };\n",
    );
    const { exitCode, output } = runEslint(target);
    assert.equal(exitCode, 0, output);
  });
});

describe("Backpressure: complexity gate", () => {
  it("flags a function whose cyclomatic complexity exceeds the cap", () => {
    // 60 sequential `if` statements -- complexity well above our 30 cap.
    const branches = Array.from(
      { length: 60 },
      (_, i) => `  if (n === ${i}) { return ${i}; }`,
    ).join("\n");
    const target = writeAsClifD(
      `function tangled(n) {\n${branches}\n  return -1;\n}\nmodule.exports = { tangled };\n`,
    );
    const { exitCode, output } = runEslint(target);
    assert.notEqual(exitCode, 0);
    assert.match(output, /complexity/);
  });

  it("accepts a function with simple control flow", () => {
    const target = writeAsClifD(
      "function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n",
    );
    const { exitCode, output } = runEslint(target);
    assert.equal(exitCode, 0, output);
  });
});

describe("Backpressure: max-depth gate", () => {
  it("flags a function nested deeper than 3 blocks", () => {
    const target = writeAsClifD(
      [
        "function deep(items) {",
        "  for (const a of items) {", // depth 1
        "    if (a) {", // depth 2
        "      for (const b of a) {", // depth 3
        "        if (b) {", // depth 4 -- violation
        "          return b;",
        "        }",
        "      }",
        "    }",
        "  }",
        "  return null;",
        "}",
        "module.exports = { deep };",
      ].join("\n"),
    );
    const { exitCode, output } = runEslint(target);
    assert.notEqual(exitCode, 0);
    assert.match(output, /max-depth/);
  });

  it("accepts a function nested at depth 3 or less", () => {
    const target = writeAsClifD(
      [
        "function shallow(items) {",
        "  for (const a of items) {",
        "    if (a) {",
        "      return a;",
        "    }",
        "  }",
        "  return null;",
        "}",
        "module.exports = { shallow };",
      ].join("\n"),
    );
    const { exitCode, output } = runEslint(target);
    assert.equal(exitCode, 0, output);
  });
});

describe("Backpressure: lint pipeline integration", () => {
  it("the npm-run-lint script wired into 'check' fails on injected violation", () => {
    // `npm run lint` runs `eslint clif-d.js`. Appending the fixture path makes
    // ESLint lint both the symlinked real CLI (which passes) and the fixture
    // (which violates max-depth). Wiring verification: the npm script
    // preserves ESLint's nonzero exit code and surfaces the rule name.
    const target = writeAsClifD(
      [
        "function deep(items) {",
        "  for (const a of items) {",
        "    if (a) {",
        "      for (const b of a) {",
        "        if (b) {",
        "          return b;",
        "        }",
        "      }",
        "    }",
        "  }",
        "  return null;",
        "}",
        "module.exports = { deep };",
      ].join("\n"),
    );
    const { exitCode, output } = runNpmScript("lint", [target]);
    assert.notEqual(exitCode, 0);
    assert.match(output, /max-depth/);
  });
});
