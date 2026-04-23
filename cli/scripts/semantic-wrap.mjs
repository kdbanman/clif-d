#!/usr/bin/env node
// Dev maintenance script. Reformats Markdown prose to one sentence per line
// ("semantic line breaks"). Rendered output is unchanged because Markdown
// collapses consecutive non-blank lines into a single paragraph; diffs become
// sentence-scoped. Dev-only -- not part of the shipped plugin. See CLAUDE.md's
// "One sentence per line in prose" rule for the convention this enforces.

import fs from 'node:fs';
import process from 'node:process';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { visitParents } from 'unist-util-visit-parents';

const ABBREVS = [
  'e.g.',
  'i.e.',
  'etc.',
  'vs.',
  'cf.',
  'Mr.',
  'Mrs.',
  'Ms.',
  'Dr.',
  'St.',
  'No.',
];

// If any ancestor has one of these types, the text node is not prose we split.
const NON_PROSE_ANCESTORS = new Set([
  'inlineCode',
  'code',
  'html',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'definition',
  'heading',
  'table',
  'tableRow',
  'tableCell',
  'yaml',
  'toml',
  'blockquote',
]);

const SPLIT_REGEX = /([.!?])([ \t]+)(?=[A-Z0-9`"'([])/g;

function isAbbreviation(text, periodIndex) {
  // Single-letter initial: letter at periodIndex-1, non-letter (or start) before it.
  if (periodIndex >= 1 && /[A-Za-z]/.test(text[periodIndex - 1])) {
    if (periodIndex < 2 || !/[A-Za-z]/.test(text[periodIndex - 2])) {
      return true;
    }
  }
  // Version-number-like: digit immediately before the period.
  if (periodIndex >= 1 && /\d/.test(text[periodIndex - 1])) return true;
  // Known multi-char abbreviations.
  for (const abbr of ABBREVS) {
    const start = periodIndex - abbr.length + 1;
    if (start < 0) continue;
    if (text.slice(start, periodIndex + 1) === abbr) return true;
  }
  return false;
}

function findSentenceSplits(text) {
  const splits = [];
  SPLIT_REGEX.lastIndex = 0;
  let m;
  while ((m = SPLIT_REGEX.exec(text)) !== null) {
    const periodIndex = m.index;
    const whitespaceStart = periodIndex + m[1].length;
    const whitespaceEnd = whitespaceStart + m[2].length;
    if (isAbbreviation(text, periodIndex)) continue;
    splits.push({ whitespaceStart, whitespaceEnd });
  }
  return splits;
}

function hasBlockedAncestor(ancestors) {
  return ancestors.some((a) => NON_PROSE_ANCESTORS.has(a.type));
}

function findParagraph(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    if (ancestors[i].type === 'paragraph') return ancestors[i];
  }
  return null;
}

function computeContinuationPrefix(paragraph) {
  // 1-indexed column of where the paragraph's text starts on its first line.
  // For a top-level paragraph this is 1 (no indent). For a paragraph inside a
  // list item it matches the hanging indent width, which is what Markdown
  // requires for the continuation to stay inside the list item.
  const col = paragraph.position?.start?.column ?? 1;
  return ' '.repeat(Math.max(0, col - 1));
}

function processSource(source) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .parse(source);

  const edits = [];

  visitParents(tree, 'text', (node, ancestors) => {
    if (hasBlockedAncestor(ancestors)) return;
    const paragraph = findParagraph(ancestors);
    if (!paragraph) return;
    if (!node.position?.start || !node.position?.end) return;

    const textStart = node.position.start.offset;
    const textEnd = node.position.end.offset;
    if (textStart == null || textEnd == null) return;

    const text = source.slice(textStart, textEnd);
    const splits = findSentenceSplits(text);
    if (splits.length === 0) return;

    const prefix = computeContinuationPrefix(paragraph);
    const replacement = `\n${prefix}`;

    for (const split of splits) {
      edits.push({
        start: textStart + split.whitespaceStart,
        end: textStart + split.whitespaceEnd,
        replacement,
      });
    }
  });

  if (edits.length === 0) return source;

  edits.sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }
  return output;
}

function assertEqual(label, actual, expected) {
  if (actual === expected) return;
  const fmt = (s) => JSON.stringify(s);
  throw new Error(
    `self-test failed: ${label}\n  expected: ${fmt(expected)}\n  actual:   ${fmt(actual)}`,
  );
}

function runSelfTests() {
  // Basic sentence split.
  assertEqual(
    'basic split',
    processSource('Foo bar. Baz qux.\n'),
    'Foo bar.\nBaz qux.\n',
  );

  // Idempotent on already-split input.
  assertEqual(
    'idempotent',
    processSource('Foo bar.\nBaz qux.\n'),
    'Foo bar.\nBaz qux.\n',
  );

  // Abbreviation guard: e.g.
  assertEqual(
    'e.g. guard',
    processSource('Use a tool, e.g. ripgrep or grep.\n'),
    'Use a tool, e.g. ripgrep or grep.\n',
  );

  // Abbreviation guard: i.e.
  assertEqual(
    'i.e. guard',
    processSource('It is, i.e. always the case here. Next up.\n'),
    'It is, i.e. always the case here.\nNext up.\n',
  );

  // Single-letter initial guard.
  assertEqual(
    'initial guard',
    processSource('A. B. Smith wrote this. Next sentence.\n'),
    'A. B. Smith wrote this.\nNext sentence.\n',
  );

  // Version-number guard.
  assertEqual(
    'version-number guard',
    processSource('Node 18. Foo bar.\n'),
    'Node 18. Foo bar.\n',
  );

  // Fenced code block pass-through.
  assertEqual(
    'fenced code',
    processSource('Intro prose. More prose.\n\n```\nline one. line two.\n```\n\nAfter. More.\n'),
    'Intro prose.\nMore prose.\n\n```\nline one. line two.\n```\n\nAfter.\nMore.\n',
  );

  // Heading pass-through.
  assertEqual(
    'heading',
    processSource('# Heading one. Heading two.\n\nBody one. Body two.\n'),
    '# Heading one. Heading two.\n\nBody one.\nBody two.\n',
  );

  // Table pass-through.
  assertEqual(
    'table',
    processSource('| A. B. | C. D. |\n| --- | --- |\n| E. F. | G. H. |\n\nAfter. More.\n'),
    '| A. B. | C. D. |\n| --- | --- |\n| E. F. | G. H. |\n\nAfter.\nMore.\n',
  );

  // Inline code pass-through inside a paragraph.
  assertEqual(
    'inline code',
    processSource('Run `npm install`. Then proceed.\n'),
    'Run `npm install`.\nThen proceed.\n',
  );

  // List item with two sentences: continuation indented to the hanging indent.
  assertEqual(
    'list item split',
    processSource('- Foo bar. Baz qux.\n'),
    '- Foo bar.\n  Baz qux.\n',
  );

  // Numbered list item: 3-space hanging indent.
  assertEqual(
    'numbered list item',
    processSource('1. Foo bar. Baz qux.\n'),
    '1. Foo bar.\n   Baz qux.\n',
  );

  // Nested list continuation indent.
  assertEqual(
    'nested list',
    processSource('- Parent item.\n  - Child item. Second sentence.\n'),
    '- Parent item.\n  - Child item.\n    Second sentence.\n',
  );

  // YAML frontmatter pass-through.
  assertEqual(
    'frontmatter',
    processSource('---\nname: foo\ndescription: One. Two.\n---\n\nBody. More body.\n'),
    '---\nname: foo\ndescription: One. Two.\n---\n\nBody.\nMore body.\n',
  );

  // Blockquote skipped (do not reformat inside blockquotes).
  assertEqual(
    'blockquote skip',
    processSource('> Quoted one. Quoted two.\n\nBody one. Body two.\n'),
    '> Quoted one. Quoted two.\n\nBody one.\nBody two.\n',
  );

  // Link text not split (link ancestor blocks).
  assertEqual(
    'link text',
    processSource('See [click here. really click](https://example.com). Next.\n'),
    'See [click here. really click](https://example.com).\nNext.\n',
  );
}

function processFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const output = processSource(source);
  if (output === source) return { path: filePath, changed: false };
  const second = processSource(output);
  if (second !== output) {
    throw new Error(`idempotence check failed for ${filePath}`);
  }
  fs.writeFileSync(filePath, output);
  return { path: filePath, changed: true };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: node cli/scripts/semantic-wrap.mjs <file> [<file> ...]');
    process.exit(2);
  }

  runSelfTests();

  for (const filePath of args) {
    const result = processFile(filePath);
    console.log(`${result.changed ? 'wrote' : 'no-op'} ${result.path}`);
  }
}

main();
