import eslint from "@eslint/js"
import prettierPlugin from "eslint-plugin-prettier"
import prettier from "eslint-config-prettier"

export default [
  eslint.configs.recommended,
  {
    ignores: ["node_modules/", "dist/", "build/"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Explicitly add globals for Node.js environment
        console: "readonly",
        process: "readonly",
        // Keep existing environment globals
        es2021: true,
        node: true,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "no-console": ["error", { allow: ["error", "warn", "info", "log"] }],
      semi: ["error", "never"],
      quotes: ["error", "double"],
      "object-curly-spacing": ["error", "always"],
      "comma-dangle": ["error", "only-multiline"],
      "no-unused-vars": ["warn"],
      "arrow-parens": ["error", "always"],
      "max-len": [
        "error",
        {
          code: 100,
          ignoreComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      "prettier/prettier": "error",
    },
  },
  prettier,
]
