import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin/vite";
import { defineConfig } from "vite-plus";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/breather/",
  plugins: [
    stylex({ runtimeInjection: false, lightningcssOptions: { minify: true } }),
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      manifest: {
        id: "/breather/",
        start_url: "/breather/",
        scope: "/breather/",
        name: "Breather",
        short_name: "Breather",
        display: "standalone",
        background_color: "#0b1020",
        theme_color: "#0b1020",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html}"] },
    }),
  ],
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
    overrides: [{ files: ["scripts/**"], rules: { "no-console": "off" } }],
  },
});
