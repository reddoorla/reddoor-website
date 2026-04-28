import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        NodeJS: "readonly",
        $state: "readonly",
        $derived: "readonly",
        $effect: "readonly",
        $props: "readonly",
        $bindable: "readonly",
        $inspect: "readonly",
        $host: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // {@html} is used in +layout.svelte for Organization JSON-LD with a hardcoded object.
      "svelte/no-at-html-tags": "off",
      "svelte/no-navigation-without-resolve": "off",
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      // The base rule reports type-only imports and overload signatures as unused.
      "no-unused-vars": "off",
    },
  },
  {
    ignores: [
      ".svelte-kit/**",
      ".slicemachine/**",
      ".netlify/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      "static/**",
      "customtypes/**",
      "**/*.d.ts",
    ],
  },
];
