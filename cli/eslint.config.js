import js from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import nodePlugin from "eslint-plugin-n";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  unicorn.configs["flat/recommended"],
  nodePlugin.configs["flat/recommended"],
  {
    plugins: { security },
    rules: {
      // Selected security rules. The eslint-plugin-security "recommended" flat
      // config still uses legacy "env" keys (as of v3.0.x), which break ESLint
      // v9 flat config. We opt into specific rules instead.
      "security/detect-child-process": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
    },
  },
  {
    // Match the literal `cli/clif-d.js` symlink as well as any file named
    // `clif-d.js` anywhere on disk. The latter is a hook for the
    // backpressure tests, which write fixture files named `clif-d.js` into
    // tempdirs to verify that the function-size, complexity, and max-depth
    // gates fire on violating fixtures.
    files: ["clif-d.js", "**/clif-d.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      // --- Relaxations from maximum strictness (see backpressure.md section 4) ---

      // CLI tools must call process.exit() with specific exit codes (CTX-005).
      "unicorn/no-process-exit": "off",
      "n/no-process-exit": "off",

      // req, ctx, arch are CLIF-D domain vocabulary, not lazy abbreviations.
      "unicorn/prevent-abbreviations": "off",

      // The CLI reads/writes JSON objects by user-supplied keys. Every access
      // is against parsed PRD data, not user-controlled code paths.
      "security/detect-object-injection": "off",

      // JSON.parse returns null for JSON null values. The CLI operates on JSON
      // data where null is a valid value.
      "unicorn/no-null": "off",

      // The shebang in bin/clif-d IS correct -- the file is registered in the
      // Claude Code plugin manifest as an executable via bin/, not via a
      // package.json "bin" field. The n/hashbang rule cannot see the plugin
      // manifest, so it reports a false positive.
      "n/hashbang": "off",

      // The CLI is intentionally CommonJS (CTX-002 -- single-file distribution,
      // no transpilation). Node.js loads the shebang-prefixed bin/clif-d as
      // CommonJS because there is no package.json with "type": "module" at the
      // repo root. "use strict" is appropriate for CommonJS modules.
      "unicorn/prefer-module": "off",

      // --- Additional strict rules beyond recommended presets ---

      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-globals": "error",
      curly: ["error", "all"],
      "no-throw-literal": "error",
      "prefer-template": "error",
      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "prefer-object-spread": "error",
      "object-shorthand": "error",

      // --- Backpressure: function-size, complexity, nesting (REQ-027) ---
      // Thresholds tuned to the current ceiling of bin/clif-d plus a small
      // margin (see backpressure.md sections 3 and 4 for rationale and the
      // specific functions sitting near each cap). Tighten when those
      // functions are decomposed.
      "max-lines-per-function": [
        "error",
        { max: 115, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 30],
      "max-depth": ["error", 3],
    },
  },
  {
    files: ["test/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
];
