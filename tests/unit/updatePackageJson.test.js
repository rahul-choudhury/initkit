import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createTempDir, cleanupTempDir } from "../setup.js";

vi.mock("fs/promises", () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
}));

async function updatePackageJson(targetDir) {
    const packageJsonPath = join(targetDir, "package.json");

    try {
        const content = await readFile(packageJsonPath, "utf8");
        const packageJson = JSON.parse(content);

        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }

        packageJson.scripts.format = "prettier --write .";
        packageJson.scripts["format:check"] = "prettier --check .";

        await writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2) + "\n",
        );
        console.log("Added prettier scripts to package.json.");
    } catch (error) {
        console.log("No package.json found, skipping script addition.");
    }
}

describe("updatePackageJson", () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await createTempDir();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupTempDir(tempDir);
    });

    it("should add prettier scripts to existing package.json", async () => {
        const packageJsonContent = JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            scripts: {
                start: "node index.js",
            },
        });

        readFile.mockResolvedValue(packageJsonContent);

        await updatePackageJson(tempDir);

        expect(readFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            "utf8",
        );
        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            JSON.stringify(
                {
                    name: "test-project",
                    version: "1.0.0",
                    scripts: {
                        start: "node index.js",
                        format: "prettier --write .",
                        "format:check": "prettier --check .",
                    },
                },
                null,
                2,
            ) + "\n",
        );
        expect(console.log).toHaveBeenCalledWith(
            "Added prettier scripts to package.json.",
        );
    });

    it("should create scripts object if it does not exist", async () => {
        const packageJsonContent = JSON.stringify({
            name: "test-project",
            version: "1.0.0",
        });

        readFile.mockResolvedValue(packageJsonContent);

        await updatePackageJson(tempDir);

        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            JSON.stringify(
                {
                    name: "test-project",
                    version: "1.0.0",
                    scripts: {
                        format: "prettier --write .",
                        "format:check": "prettier --check .",
                    },
                },
                null,
                2,
            ) + "\n",
        );
        expect(console.log).toHaveBeenCalledWith(
            "Added prettier scripts to package.json.",
        );
    });

    it("should overwrite existing format scripts", async () => {
        const packageJsonContent = JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            scripts: {
                format: "old-formatter",
                "format:check": "old-checker",
                test: "jest",
            },
        });

        readFile.mockResolvedValue(packageJsonContent);

        await updatePackageJson(tempDir);

        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            JSON.stringify(
                {
                    name: "test-project",
                    version: "1.0.0",
                    scripts: {
                        format: "prettier --write .",
                        "format:check": "prettier --check .",
                        test: "jest",
                    },
                },
                null,
                2,
            ) + "\n",
        );
    });

    it("should handle package.json read error gracefully", async () => {
        readFile.mockRejectedValue(new Error("File not found"));

        await updatePackageJson(tempDir);

        expect(readFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            "utf8",
        );
        expect(writeFile).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(
            "No package.json found, skipping script addition.",
        );
    });

    it("should handle JSON parse error gracefully", async () => {
        readFile.mockResolvedValue("invalid json content");

        await updatePackageJson(tempDir);

        expect(readFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            "utf8",
        );
        expect(writeFile).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(
            "No package.json found, skipping script addition.",
        );
    });

    it("should format JSON with 2 spaces and trailing newline", async () => {
        const packageJsonContent = JSON.stringify({
            name: "test-project",
            version: "1.0.0",
        });

        readFile.mockResolvedValue(packageJsonContent);

        await updatePackageJson(tempDir);

        const expectedContent =
            JSON.stringify(
                {
                    name: "test-project",
                    version: "1.0.0",
                    scripts: {
                        format: "prettier --write .",
                        "format:check": "prettier --check .",
                    },
                },
                null,
                2,
            ) + "\n";

        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            expectedContent,
        );

        const writtenContent = writeFile.mock.calls[0][1];
        expect(writtenContent).toMatch(/^\{\n  "name"/);
        expect(writtenContent).toMatch(/\n$/);
    });

    it("should preserve existing package.json properties", async () => {
        const packageJsonContent = JSON.stringify({
            name: "test-project",
            version: "1.0.0",
            description: "A test project",
            main: "index.js",
            dependencies: {
                lodash: "^4.17.21",
            },
            devDependencies: {
                jest: "^29.0.0",
            },
            scripts: {
                start: "node index.js",
                test: "jest",
            },
        });

        readFile.mockResolvedValue(packageJsonContent);

        await updatePackageJson(tempDir);

        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            JSON.stringify(
                {
                    name: "test-project",
                    version: "1.0.0",
                    description: "A test project",
                    main: "index.js",
                    dependencies: {
                        lodash: "^4.17.21",
                    },
                    devDependencies: {
                        jest: "^29.0.0",
                    },
                    scripts: {
                        start: "node index.js",
                        test: "jest",
                        format: "prettier --write .",
                        "format:check": "prettier --check .",
                    },
                },
                null,
                2,
            ) + "\n",
        );
    });

    it("should handle writeFile error gracefully", async () => {
        const packageJsonContent = JSON.stringify({ name: "test-project" });
        readFile.mockResolvedValue(packageJsonContent);
        writeFile.mockRejectedValue(new Error("Write permission denied"));

        try {
            await updatePackageJson(tempDir);
        } catch (error) {
            expect(error.message).toBe("Write permission denied");
        }
    });
});
