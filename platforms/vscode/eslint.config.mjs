import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Migrated from .eslintrc.json: ESLint 9+ only reads flat config.
// "@typescript-eslint/semi" was dropped upstream in typescript-eslint v6
// (moved to @stylistic), and the react-hooks rules were removed because the
// extension source is plain TypeScript and the plugin was never installed.
export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "function",
          format: ["PascalCase", "camelCase"],
        },
      ],
      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "off",
    },
  },
];
