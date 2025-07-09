#!/usr/bin/env node

import {
    copyFile,
    readdir,
    stat,
    mkdir,
    access,
    readFile,
    writeFile,
} from "fs/promises";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
});

async function main() {
    const templatesDir = join(__dirname, "..", "templates");
    const targetDir = process.cwd();

    console.log("Setting up project templates...");
    await copyDirectory(templatesDir, targetDir, templatesDir);
    console.log("Templates added successfully!");

    const packageManager = await detectPackageManager(targetDir);
    await installDependency(packageManager, "prettier-plugin-tailwindcss");
    await updatePackageJson(targetDir);
}

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
                    const response = await promptOverwrite(relativePath);
                    if (response === "all") {
                        overwriteAll = true;
                        shouldCopy = true;
                    } else {
                        shouldCopy = response;
                    }
                }
            } catch (error) {
                // File doesn't exist. Is this an anti-pattern?
            }

            if (shouldCopy) {
                await mkdir(destDir, { recursive: true });
                await copyFile(srcPath, destPath);
            }
        }
    }

    return overwriteAll;
}

async function detectPackageManager(targetDir) {
    try {
        await access(join(targetDir, "pnpm-lock.yaml"));
        return "pnpm";
    } catch (error) {
        // File doesn't exist
    }

    try {
        await access(join(targetDir, "yarn.lock"));
        return "yarn";
    } catch (error) {
        // File doesn't exist
    }

    return "npm";
}

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
