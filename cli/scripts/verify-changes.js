#!/usr/bin/env node
// Verifies that a commit only changed whitespace in a given file.
// Usage: node cli/scripts/verify-changes.js <file> <commit>
// Exits 0 if non-whitespace content is identical before and after the commit,
// exits 1 if it differs, exits 2 on usage or git errors.

import { execSync } from 'node:child_process';
import { resolve, relative } from 'node:path';

function gitShow(ref, repoRelPath) {
  return execSync(`git show "${ref}:${repoRelPath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('usage: node cli/scripts/verify-changes.js <file> <commit>');
    process.exit(2);
  }

  const [filePath, commit] = args;

  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    console.error('error: not in a git repository');
    process.exit(2);
  }

  const repoRelPath = relative(repoRoot, resolve(filePath));

  let before, after;
  try {
    before = gitShow(`${commit}^`, repoRelPath);
  } catch (err) {
    console.error(`error: could not read ${repoRelPath} at ${commit}^ -- ${err.message.trim()}`);
    process.exit(2);
  }
  try {
    after = gitShow(commit, repoRelPath);
  } catch (err) {
    console.error(`error: could not read ${repoRelPath} at ${commit} -- ${err.message.trim()}`);
    process.exit(2);
  }

  const strip = (s) => s.replace(/\s/g, '');
  if (strip(before) === strip(after)) {
    console.log('ok: non-whitespace content unchanged');
    process.exit(0);
  } else {
    console.error('error: non-whitespace content differs');
    process.exit(1);
  }
}

main();
