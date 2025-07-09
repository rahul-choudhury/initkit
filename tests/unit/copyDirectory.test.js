import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdir, stat, mkdir, access, copyFile } from "fs/promises";
import { join, dirname, relative } from "path";
import { createTempDir, cleanupTempDir } from "../setup.js";

vi.mock("fs/promises", () => ({
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    copyFile: vi.fn(),
}));

const mockPromptOverwrite = vi.fn();

async function copyDirectory(src, dest, baseSrc, overwriteAll = false) {
    const entries = await readdir(src);

    for (const entry of entries) {
        const srcPath = join(src, entry);
        const stats = await stat(srcPath);

        if (stats.isDirectory()) {
            overwriteAll = await copyDirectory(
                srcPath,
                dest,
                baseSrc,
                overwriteAll,
            );
        } else {
            const relativePath = relative(baseSrc, srcPath);
            const destPath = join(dest, relativePath);
            const destDir = dirname(destPath);

            let shouldCopy = true;
            try {
                await access(destPath);
                if (!overwriteAll) {
                    const response = await mockPromptOverwrite(relativePath);
                    if (response === "all") {
                        overwriteAll = true;
                        shouldCopy = true;
                    } else {
                        shouldCopy = response;
                    }
                }
            } catch (error) {}

            if (shouldCopy) {
                await mkdir(destDir, { recursive: true });
                await copyFile(srcPath, destPath);
            }
        }
    }

    return overwriteAll;
}

describe("copyDirectory", () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await createTempDir();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupTempDir(tempDir);
    });

    it("should copy files from source to destination", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["file1.txt", "file2.js"]);
        stat.mockImplementation((path) => ({
            isDirectory: () => false,
        }));
        access.mockRejectedValue(new Error("File not found"));
        await copyDirectory(src, dest, baseSrc);

        expect(readdir).toHaveBeenCalledWith(src);
        expect(stat).toHaveBeenCalledTimes(2);
        expect(mkdir).toHaveBeenCalledTimes(2);
        expect(copyFile).toHaveBeenCalledTimes(2);
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "file1.txt"),
            join(dest, "file1.txt"),
        );
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "file2.js"),
            join(dest, "file2.js"),
        );
    });

    it("should recursively copy nested directories", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockImplementation((path) => {
            if (path === src) {
                return Promise.resolve(["folder", "file.txt"]);
            }
            if (path === join(src, "folder")) {
                return Promise.resolve(["nested.js"]);
            }
            return Promise.resolve([]);
        });

        stat.mockImplementation((path) => ({
            isDirectory: () =>
                path.includes("folder") && !path.includes("nested.js"),
        }));

        access.mockRejectedValue(new Error("File not found"));

        await copyDirectory(src, dest, baseSrc);

        expect(readdir).toHaveBeenCalledWith(src);
        expect(readdir).toHaveBeenCalledWith(join(src, "folder"));
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "file.txt"),
            join(dest, "file.txt"),
        );
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "folder", "nested.js"),
            join(dest, "folder", "nested.js"),
        );
    });

    it("should prompt for overwrite when file exists", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["existing.txt"]);
        stat.mockImplementation(() => ({
            isDirectory: () => false,
        }));
        access.mockResolvedValue();
        mockPromptOverwrite.mockResolvedValue(true);
        await copyDirectory(src, dest, baseSrc);

        expect(mockPromptOverwrite).toHaveBeenCalledWith("existing.txt");
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "existing.txt"),
            join(dest, "existing.txt"),
        );
    });

    it("should skip copying when user chooses not to overwrite", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["existing.txt"]);
        stat.mockImplementation(() => ({
            isDirectory: () => false,
        }));
        access.mockResolvedValue();
        mockPromptOverwrite.mockResolvedValue(false);
        await copyDirectory(src, dest, baseSrc);

        expect(mockPromptOverwrite).toHaveBeenCalledWith("existing.txt");
        expect(copyFile).not.toHaveBeenCalled();
    });

    it('should handle "overwrite all" response', async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["file1.txt", "file2.txt"]);
        stat.mockImplementation(() => ({
            isDirectory: () => false,
        }));
        access.mockResolvedValue();
        mockPromptOverwrite.mockResolvedValueOnce("all");
        const result = await copyDirectory(src, dest, baseSrc);

        expect(mockPromptOverwrite).toHaveBeenCalledTimes(1);
        expect(copyFile).toHaveBeenCalledTimes(2);
        expect(result).toBe(true);
    });

    it("should respect existing overwriteAll flag", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["file1.txt"]);
        stat.mockImplementation(() => ({
            isDirectory: () => false,
        }));
        access.mockResolvedValue();
        await copyDirectory(src, dest, baseSrc, true);
        expect(mockPromptOverwrite).not.toHaveBeenCalled();
        expect(copyFile).toHaveBeenCalledTimes(1);
    });

    it("should create destination directories", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockResolvedValue(["file.txt"]);
        stat.mockImplementation(() => ({
            isDirectory: () => false,
        }));
        access.mockRejectedValue(new Error("File not found"));

        await copyDirectory(src, dest, baseSrc);

        expect(mkdir).toHaveBeenCalledWith(dest, { recursive: true });
    });

    it("should handle nested directory structure correctly", async () => {
        const src = "/source";
        const dest = "/dest";
        const baseSrc = "/source";

        readdir.mockImplementation((path) => {
            if (path === src) {
                return Promise.resolve(["subfolder"]);
            }
            if (path === join(src, "subfolder")) {
                return Promise.resolve(["nested.txt"]);
            }
            return Promise.resolve([]);
        });

        stat.mockImplementation((path) => ({
            isDirectory: () =>
                path.includes("subfolder") && !path.includes("nested.txt"),
        }));

        access.mockRejectedValue(new Error("File not found"));

        await copyDirectory(src, dest, baseSrc);

        expect(mkdir).toHaveBeenCalledWith(join(dest, "subfolder"), {
            recursive: true,
        });
        expect(copyFile).toHaveBeenCalledWith(
            join(src, "subfolder", "nested.txt"),
            join(dest, "subfolder", "nested.txt"),
        );
    });
});
