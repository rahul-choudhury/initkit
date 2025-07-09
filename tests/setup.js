import { vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

beforeEach(() => {
    vi.clearAllMocks();
});

export async function createTempDir() {
    return await mkdtemp(join(tmpdir(), "initkit-test-"));
}

export async function cleanupTempDir(dir) {
    await rm(dir, { recursive: true, force: true });
}

global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
};
