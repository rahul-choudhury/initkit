import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInterface } from "readline";

vi.mock("readline", () => ({
    createInterface: vi.fn(),
}));

async function promptOverwrite(filePath) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(
            `File ${filePath} already exists. Overwrite? (y/N/a for all): `,
            (answer) => {
                rl.close();
                const lower = answer.toLowerCase();
                if (lower === "a" || lower === "all") {
                    resolve("all");
                } else {
                    resolve(lower === "y" || lower === "yes");
                }
            },
        );
    });
}

describe("promptOverwrite", () => {
    let mockRl;

    beforeEach(() => {
        mockRl = {
            question: vi.fn(),
            close: vi.fn(),
        };
        createInterface.mockReturnValue(mockRl);
    });

    it('should return true for "y" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("y");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(true);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return true for "yes" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("yes");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(true);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return false for "n" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("n");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(false);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return false for "no" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("no");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(false);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it("should return false for empty answer (default)", async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(false);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return "all" for "a" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("a");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe("all");
        expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return "all" for "all" answer', async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("all");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe("all");
        expect(mockRl.close).toHaveBeenCalled();
    });

    it("should be case insensitive", async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("Y");
        });

        const result = await promptOverwrite("test.txt");
        expect(result).toBe(true);
        expect(mockRl.close).toHaveBeenCalled();
    });

    it("should include the file path in the prompt", async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("n");
        });

        await promptOverwrite("path/to/file.txt");
        expect(mockRl.question).toHaveBeenCalledWith(
            "File path/to/file.txt already exists. Overwrite? (y/N/a for all): ",
            expect.any(Function),
        );
    });

    it("should create readline interface with correct options", async () => {
        mockRl.question.mockImplementation((prompt, callback) => {
            callback("n");
        });

        await promptOverwrite("test.txt");
        expect(createInterface).toHaveBeenCalledWith({
            input: process.stdin,
            output: process.stdout,
        });
    });
});
