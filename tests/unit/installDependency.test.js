import { describe, it, expect, vi, beforeEach } from "vitest";
import { spawn } from "child_process";
import { EventEmitter } from "events";

vi.mock("child_process", () => ({
    spawn: vi.fn(),
}));

async function installDependency(packageManager, packageName) {
    const commands = {
        npm: ["npm", "install", "--save-dev", packageName],
        yarn: ["yarn", "add", "--dev", packageName],
        pnpm: ["pnpm", "add", "--save-dev", packageName],
    };

    const [cmd, ...args] = commands[packageManager];

    return new Promise((resolve, reject) => {
        console.log(`Installing ${packageName} with ${packageManager}...`);
        const child = spawn(cmd, args, { stdio: "inherit" });

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Installation failed with code ${code}`));
            }
        });
    });
}

describe("installDependency", () => {
    let mockChild;

    beforeEach(() => {
        mockChild = new EventEmitter();
        spawn.mockReturnValue(mockChild);
        vi.clearAllMocks();
    });

    it("should install with npm when packageManager is npm", async () => {
        const installPromise = installDependency("npm", "test-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await installPromise;

        expect(spawn).toHaveBeenCalledWith(
            "npm",
            ["install", "--save-dev", "test-package"],
            { stdio: "inherit" },
        );
    });

    it("should install with yarn when packageManager is yarn", async () => {
        const installPromise = installDependency("yarn", "test-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await installPromise;

        expect(spawn).toHaveBeenCalledWith(
            "yarn",
            ["add", "--dev", "test-package"],
            { stdio: "inherit" },
        );
    });

    it("should install with pnpm when packageManager is pnpm", async () => {
        const installPromise = installDependency("pnpm", "test-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await installPromise;

        expect(spawn).toHaveBeenCalledWith(
            "pnpm",
            ["add", "--save-dev", "test-package"],
            { stdio: "inherit" },
        );
    });

    it("should resolve when installation succeeds (exit code 0)", async () => {
        const installPromise = installDependency("npm", "test-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await expect(installPromise).resolves.toBeUndefined();
    });

    it("should reject when installation fails (non-zero exit code)", async () => {
        const installPromise = installDependency("npm", "test-package");

        setTimeout(() => mockChild.emit("exit", 1), 0);

        await expect(installPromise).rejects.toThrow(
            "Installation failed with code 1",
        );
    });

    it("should reject when spawn emits error", async () => {
        const installPromise = installDependency("npm", "test-package");

        const error = new Error("Command not found");
        setTimeout(() => mockChild.emit("error", error), 0);

        await expect(installPromise).rejects.toThrow("Command not found");
    });

    it("should log installation message", async () => {
        const installPromise = installDependency("npm", "test-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await installPromise;

        expect(console.log).toHaveBeenCalledWith(
            "Installing test-package with npm...",
        );
    });

    it("should handle different package names", async () => {
        const installPromise = installDependency("yarn", "my-custom-package");

        setTimeout(() => mockChild.emit("exit", 0), 0);

        await installPromise;

        expect(spawn).toHaveBeenCalledWith(
            "yarn",
            ["add", "--dev", "my-custom-package"],
            { stdio: "inherit" },
        );
        expect(console.log).toHaveBeenCalledWith(
            "Installing my-custom-package with yarn...",
        );
    });

    it("should use stdio: inherit for all package managers", async () => {
        const managers = ["npm", "yarn", "pnpm"];

        for (const manager of managers) {
            const installPromise = installDependency(manager, "test-package");
            setTimeout(() => mockChild.emit("exit", 0), 0);
            await installPromise;

            expect(spawn).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                { stdio: "inherit" },
            );
        }
    });

    it("should handle different exit codes correctly", async () => {
        const exitCodes = [0, 1, 2, 127, 255];

        for (const code of exitCodes) {
            const installPromise = installDependency("npm", "test-package");
            setTimeout(() => mockChild.emit("exit", code), 0);

            if (code === 0) {
                await expect(installPromise).resolves.toBeUndefined();
            } else {
                await expect(installPromise).rejects.toThrow(
                    `Installation failed with code ${code}`,
                );
            }
        }
    });
});
