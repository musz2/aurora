import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "seed.prod": "prisma/seed.prod.ts",
  },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Bundle the workspace TS package so the build is self-contained.
  noExternal: ["@aurora/shared"],
});
