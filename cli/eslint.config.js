import js from "@eslint/js";
import unicorn from "eslint-plugin-unicorn";
import nodePlugin from "eslint-plugin-n";
import security from "eslint-plugin-security";

export default [
  js.configs.recommended,
  unicorn.configs.recommended,
  nodePlugin.configs["flat/recommended"],
  security.configs.recommended,
  {
    files: ["../bin/clif-d"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
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
