import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BIN = path.resolve(__dirname, "../../bin/clif-d");

/**
 * Run clif-d with args, return { stdout, stderr, exitCode }.
 * @param {string[]} args
 * @param {{ cwd?: string, input?: string }} [options]
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function run(args, options) {
  const result = spawnSync(BIN, args, {
    cwd: options?.cwd ?? process.cwd(),
    encoding: "utf8",
    timeout: 5000,
    input: options?.input,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

/**
 * Create a temp dir with a clif-d/prd.json fixture. Returns the dir path.
 * @param {object} prd
 * @returns {string}
 */
export function withFixture(prd) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clif-d-test-"));
  const cliDir = path.join(dir, "clif-d");
  fs.mkdirSync(cliDir);
  fs.writeFileSync(path.join(cliDir, "prd.json"), JSON.stringify(prd, null, 2));
  return dir;
}

export const MINIMAL_PRD = {
  $schema: "prd-schema.json",
  product_name: "test",
  concept_summary: { description: "test", reference_link: "test" },
  context: [],
  architecture: [],
  requirements: [
    {
      id: "REQ-001",
      title: "First requirement",
      description: "Desc",
      acceptance_criteria: "Done when done",
      abstraction_level: "high",
      status: "not_started",
      priority: 1,
    },
    {
      id: "REQ-002",
      title: "Second requirement",
      description: "Desc",
      acceptance_criteria: { given: "G", when: "W", then: "T" },
      abstraction_level: "low",
      priority: 2,
      status: "done",
      implementation_commit: "abc1234",
      dependencies: ["REQ-001"],
    },
  ],
};
