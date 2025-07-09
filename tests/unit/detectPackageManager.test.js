import { describe, it, expect, vi, beforeEach } from "vitest";
import { access } from "fs/promises";
import { join } from "path";
import { createTempDir, cleanupTempDir } from "../setup.js";

vi.mock("fs/promises", () => ({
    access: vi.fn(),
}));

async function detectPackageManager(targetDir) {
    try {
        await access(join(targetDir, "pnpm-lock.yaml"));
        return "pnpm";
    } catch (error) {}

    try {
        await access(join(targetDir, "yarn.lock"));
        return "yarn";
    } catch (error) {}

    return "npm";
}

describe("detectPackageManager", () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await createTempDir();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupTempDir(tempDir);
    });

    it("should detect pnpm when pnpm-lock.yaml exists", async () => {
        access.mockImplementation((path) => {
            if (path.endsWith("pnpm-lock.yaml")) {
                return Promise.resolve();
            }
            return Promise.reject(new Error("File not found"));
        });

        const result = await detectPackageManager(tempDir);
        expect(result).toBe("pnpm");
        expect(access).toHaveBeenCalledWith(join(tempDir, "pnpm-lock.yaml"));
    });

    it("should detect yarn when yarn.lock exists but pnpm-lock.yaml does not", async () => {
        access.mockImplementation((path) => {
            if (path.endsWith("yarn.lock")) {
                return Promise.resolve();
            }
            return Promise.reject(new Error("File not found"));
        });

        const result = await detectPackageManager(tempDir);
        expect(result).toBe("yarn");
        expect(access).toHaveBeenCalledWith(join(tempDir, "pnpm-lock.yaml"));
        expect(access).toHaveBeenCalledWith(join(tempDir, "yarn.lock"));
    });

    it("should default to npm when no lock files exist", async () => {
        access.mockRejectedValue(new Error("File not found"));

        const result = await detectPackageManager(tempDir);
        expect(result).toBe("npm");
        expect(access).toHaveBeenCalledWith(join(tempDir, "pnpm-lock.yaml"));
        expect(access).toHaveBeenCalledWith(join(tempDir, "yarn.lock"));
    });

    it("should check files in the correct order", async () => {
        access.mockRejectedValue(new Error("File not found"));

        await detectPackageManager(tempDir);

        expect(access).toHaveBeenNthCalledWith(
            1,
            join(tempDir, "pnpm-lock.yaml"),
        );
        expect(access).toHaveBeenNthCalledWith(2, join(tempDir, "yarn.lock"));
        expect(access).toHaveBeenCalledTimes(2);
    });
});
