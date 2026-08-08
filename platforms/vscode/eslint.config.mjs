// The flat configuration ESLint has wanted since version 9. The rules are the
// ones the old .eslintrc.json had, minus the two that moved out of
// typescript-eslint into a formatter, which prettier does here.
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["out/**", "dist/**", "assets/**", "schemas/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tseslint,
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
    },
  },
];
