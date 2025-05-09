module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-console": ["error", { allow: ["error", "warn", "info"] }],
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
  },
  ignorePatterns: ["node_modules/", "dist/", "build/"],
}
