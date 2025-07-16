import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";


export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  {
    ignores: ["build/*", "npm/*", "node_modules/*"],
  },
  {
    rules: {
      "semi": [2, "always"],
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/no-namespace": "off",
      "no-constant-condition": ["error", { "checkLoops": false }],
    }
  }
]);
