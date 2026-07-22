import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        series: resolve(__dirname, "series/index.html"),
        afterDark: resolve(__dirname, "series/after-dark/index.html"),
        gridGrade: resolve(__dirname, "series/grid-grade/index.html"),
        wildEdge: resolve(__dirname, "series/wild-edge/index.html"),
        about: resolve(__dirname, "about/index.html"),
        contact: resolve(__dirname, "contact/index.html"),
      },
    },
  },
});
