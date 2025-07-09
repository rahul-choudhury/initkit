import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.js"],
        exclude: ["node_modules", "dist"],
        testTimeout: 10000,
        setupFiles: ["tests/setup.js"],
    },
});
