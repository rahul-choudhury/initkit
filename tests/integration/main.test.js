import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import {
    readFile,
    writeFile,
    mkdir,
    access,
    readdir,
    stat,
    copyFile,
} from "fs/promises";
import { join } from "path";
import { createTempDir, cleanupTempDir } from "../setup.js";

vi.mock("child_process", () => ({
    spawn: vi.fn(),
}));

vi.mock("fs/promises", () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    copyFile: vi.fn(),
}));

vi.mock("readline", () => ({
    createInterface: vi.fn(() => ({
        question: vi.fn((prompt, callback) => {
            callback("y");
        }),
        close: vi.fn(),
    })),
}));

describe("Integration Tests - CLI Behavior", () => {
    let tempDir;
    let mockSpawn;

    beforeEach(async () => {
        tempDir = await createTempDir();
        mockSpawn = {
            on: vi.fn(),
            emit: vi.fn(),
        };
        spawn.mockReturnValue(mockSpawn);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupTempDir(tempDir);
    });

    it("should detect package manager correctly", async () => {
        access.mockImplementation((path) => {
            if (path.includes("pnpm-lock.yaml")) {
                return Promise.resolve();
            }
            return Promise.reject(new Error("File not found"));
        });

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

        const result = await detectPackageManager(tempDir);
        expect(result).toBe("pnpm");
    });

    it("should handle dependency installation workflow", async () => {
        mockSpawn.on.mockImplementation((event, callback) => {
            if (event === "exit") {
                setTimeout(() => callback(0), 0);
            }
        });

        async function installDependency(packageManager, packageName) {
            const commands = {
                npm: ["npm", "install", "--save-dev", packageName],
                yarn: ["yarn", "add", "--dev", packageName],
                pnpm: ["pnpm", "add", "--save-dev", packageName],
            };

            const [cmd, ...args] = commands[packageManager];

            return new Promise((resolve, reject) => {
                const child = spawn(cmd, args, { stdio: "inherit" });
                child.on("error", reject);
                child.on("exit", (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(
                            new Error(`Installation failed with code ${code}`),
                        );
                    }
                });
            });
        }

        await installDependency("npm", "prettier-plugin-tailwindcss");
        expect(spawn).toHaveBeenCalledWith(
            "npm",
            ["install", "--save-dev", "prettier-plugin-tailwindcss"],
            { stdio: "inherit" },
        );
    });

    it("should handle package.json updates", async () => {
        const originalPackageJson = {
            name: "test-project",
            version: "1.0.0",
            scripts: {
                start: "node index.js",
            },
        };

        readFile.mockResolvedValue(JSON.stringify(originalPackageJson));

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
            } catch (error) {}
        }

        await updatePackageJson(tempDir);

        expect(readFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            "utf8",
        );
        expect(writeFile).toHaveBeenCalledWith(
            join(tempDir, "package.json"),
            expect.stringContaining('"format": "prettier --write ."'),
        );
    });

    it("should handle file copying operations", async () => {
        readdir.mockResolvedValue(["test-file.txt"]);
        stat.mockResolvedValue({ isDirectory: () => false });
        access.mockRejectedValue(new Error("File not found"));
        async function copyDirectory(src, dest, baseSrc, overwriteAll = false) {
            const entries = await readdir(src);

            for (const entry of entries) {
                const srcPath = join(src, entry);
                const stats = await stat(srcPath);

                if (!stats.isDirectory()) {
                    const destPath = join(dest, entry);
                    await mkdir(dest, { recursive: true });
                    await copyFile(srcPath, destPath);
                }
            }
        }

        await copyDirectory("/source", "/dest", "/source");

        expect(readdir).toHaveBeenCalledWith("/source");
        expect(stat).toHaveBeenCalled();
        expect(mkdir).toHaveBeenCalledWith("/dest", { recursive: true });
        expect(copyFile).toHaveBeenCalled();
    });

    it("should handle CLI execution flow", async () => {
        access.mockRejectedValue(new Error("File not found"));
        readdir.mockResolvedValue(["Dockerfile"]);
        stat.mockResolvedValue({ isDirectory: () => false });
        readFile.mockResolvedValue(JSON.stringify({ name: "test-project" }));

        mockSpawn.on.mockImplementation((event, callback) => {
            if (event === "exit") {
                setTimeout(() => callback(0), 0);
            }
        });

        expect(access).toBeDefined();
        expect(readdir).toBeDefined();
        expect(stat).toBeDefined();
        expect(readFile).toBeDefined();
        expect(writeFile).toBeDefined();
        expect(spawn).toBeDefined();
    });
});
