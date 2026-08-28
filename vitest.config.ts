import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Server actions and helpers run in node; component tests opt into jsdom
    // with an `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // tsconfig sets jsx: "react-jsx", so esbuild compiles TSX on its own and no
  // React plugin is needed (which also avoids a vite 7 peer conflict).
  esbuild: {
    jsx: "automatic",
  },
});
