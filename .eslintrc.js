module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: [
    "airbnb-base",
    "eslint:recommended",
    "prettier", // Add prettier to avoid conflicts
  ],
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
    "import/prefer-default-export": "off",
    "no-underscore-dangle": "off",
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js"],
      },
    },
  },
}
