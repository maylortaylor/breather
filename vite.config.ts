import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/breather/",
  plugins: [react()],
  fmt: {
    singleQuote: false,
    semi: true,
    trailingComma: "es5",
    tabWidth: 2,
    useTabs: false,
    printWidth: 100,
    ignorePatterns: [".scratch/**", "docs/**", "*.md", "dist/**", "coverage/**"],
  },
  lint: {
    ignorePatterns: ["dist/**", "coverage/**"],
    plugins: ["react", "typescript"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "no-console": "error",
      "typescript/no-explicit-any": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
});
