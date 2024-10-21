// FIXME: Parking this for now, it's beside the scope of this project
// $ deno run -A src/tts.ts
// Downloading piper_linux_x86_64.tar.gz to $HOME/piperTTS/...
// Extract piper_linux_x86_64.tar.gz
// Make piper_linux_x86_64.tar.gz executable...
// installPiper(): Error, NotFound: No such file or directory (os error 2): chmod '$HOME/piperTTS/piper'
// extractTarGz(): Extracting  piper/
// error: Uncaught (in promise) NotFound: No such file or directory (os error 2): chmod '$HOME/piperTTS/piper'
//         await Deno.chmod(piper, 0o755); // Make the file executable
//         ^
//     at async Object.chmod (ext:deno_fs/30_fs.js:107:3)
//     at async installPiper (file://scribe_cast/src/tts.ts:262:9)

import { TarStreamEntry, UntarStream } from "jsr:@std/tar/untar-stream";
import { dirname, normalize } from "https://deno.land/std/path/mod.ts";
import { decompress } from "https://deno.land/x/zip/mod.ts";
import { ensureDir } from "https://deno.land/std/fs/mod.ts";

const OS = Deno.build.os;
const ARCH = Deno.build.arch;
const ISWINDOWS = OS === "windows";
const HOME = Deno.env.get(ISWINDOWS ? "USERPROFILE" : "HOME") || ".";
const PIPER_VERSION = "2023.11.14-2";
type OperatingSys = "windows" | "darwin" | "linux";
type Architecture = "aarch64" | "armv7l" | "x86_64" | "amd64";
type FileInfo = {
    os: OperatingSys;
    arch: Architecture;
    fileName: string;
};
const fileDict: Record<string, FileInfo> = {
    "windows": {
        os: "windows",
        arch: "amd64",
        fileName: "piper_windows_amd64.zip",
    },
    "darwin_x86_64": {
        os: "darwin",
        arch: "x86_64",
        fileName: "piper_macOS_x86_64.tar.gz",
    },
    "darwin_aarch64": {
        os: "darwin",
        arch: "aarch64",
        fileName: "piper_macOS_aarch64.tar.gz",
    },
    "linux_x86_64": {
        os: "linux",
        arch: "x86_64",
        fileName: "piper_linux_x86_64.tar.gz",
    },
    "linux_aarch64": {
        os: "linux",
        arch: "aarch64",
        fileName: "piper_linux_aarch64.tar.gz",
    },
    "linux_armv7l": {
        os: "linux",
        arch: "armv7l",
        fileName: "piper_linux_armv7l.tar.gz",
    },
};

/**
 * Retrieves file information based on the given OS and architecture.
 * @param os The operating system ("Windows", "macOS", or "Linux").
 * @param arch The CPU architecture ("aarch64", "x86_64", or "amd64" on Windows).
 * @returns The corresponding FileInfo object, or undefined if not found.
 */
function getFileInfo(os: string, arch: string): FileInfo {
    if (os === "windows") {
        return fileDict["windows"];
    }
    return fileDict[`${os}_${arch}`];
}

/**
 * Checks if a command is available in the system's PATH.
 *
 * @param command - The command to check.
 * @returns A Promise that resolves to true if the command exists and can be executed, false otherwise.
 *
 * This function attempts to run the command with a "--help" argument.
 * It returns true if the command executes successfully, false if it fails or throws an error.
 */
async function checkCommand(command: string): Promise<boolean> {
    try {
        const process = new Deno.Command(command, {
            args: ["--help"],
        });

        const { success } = await process.output();

        return success;
    } catch {
        return false;
    }
}

/**
 * Updates the system's PATH environment variable with a new directory.
 *
 * @param newPath - The absolute path to add to the system's PATH.
 * @returns A boolean that resolves to true if the PATH was successfully updated, false otherwise.
 * @throws Will throw an error if there's an issue accessing or modifying environment variables.
 *
 * This function performs the following steps:
 * 1. Checks if the path is already in the PATH.
 * 2. Constructs a new PATH string, prepending the new path.
 * 3. Updates the system's PATH environment variable.
 *
 * The function is cross-platform, handling differences between Windows and Unix-like systems.
 */
function addToPath(newPath: string): boolean {
    const currentPath = Deno.env.get("PATH") || "";

    const splitCurrentPath = currentPath.split(ISWINDOWS ? ";" : ":");
    // Check if newPath exists in PATH
    if (splitCurrentPath.includes(newPath)) {
        console.log(`addToPath(): ${newPath} is already in PATH.`);
        return true;
    }

    // Construct the new PATH
    const updatedPath = ISWINDOWS
        ? `${newPath};${currentPath}`
        : `${newPath}:${currentPath}`;

    // Update the PATH environment variable
    try {
        Deno.env.set("PATH", updatedPath);
        console.log(`addToPath(): Successfully added ${newPath} to PATH.`);
        return true;
    } catch (error: unknown) {
        console.error(`addToPath(): Failed to update PATH: ${error}`);
        return false;
    }
}

/**
 * Validates if the given OS and architecture combination is supported.
 * @param os - The operating system ("windows", "darwin", or "linux").
 * @param arch - The CPU architecture ("aarch64", "x86_64", or "amd64").
 * @throws {Error} If the combination is not supported.
 * @assertion {os is OS}
 * @assertion {arch is Architecture}
 */
function validateOsArch(os: string, arch: string): void {
    if (os === "windows") {
        if (arch !== "amd64") {
            throw new Error(`Unsupported architecture for Windows: ${arch}`);
        }
    } else if (os === "darwin" || os === "linux") {
        if (arch !== "x86_64" && arch !== "aarch64") {
            throw new Error(`Unsupported architecture for ${os}: ${arch}`);
        }
    } else {
        throw new Error(`Unsupported OS: ${os}`);
    }
}

/**
 * Gets the latest `piper` executable URL for the current the operating system.
 * @param os - The operating system used i.e. windows, linux, or darwin.
 * @param arch - The CPU architecture i.e. x86_64, aarch64 / (amd64 on Windows).
 * @returns The URL to download `piper` for the specified OS.
 * @throws Will throw an error for unsupported operating systems.
 */

/**
 * extractes a .zip file on Windows.
 * Uses the decompress function from the zip module to extract contents.
 * @param inputPath Path to the .zip file
 * @param outputDir Directory to extract files to
 */
async function extractZip(inputPath: string, outputDir: string) {
    if (!ISWINDOWS) {
        console.error("This function is for Windows only. Exiting...");
        Deno.exit(1);
    }

    await ensureDir(outputDir);
    const status = await decompress(inputPath, outputDir);
    if (typeof status === "boolean") {
        throw new Error(`extractZip(): ${inputPath} could not be unzipped`);
    }
}

/**
 * extractes a .tar.gz file on Unix systems.
 * Uses built-in Deno APIs to decompress gzip and extract tar contents.
 * @param inputPath Path to the .tar.gz file
 * @param outputDir Directory to extract files to
 */
async function extractTarGz(
    inputPath: string,
    outputDir: string,
): Promise<void> {
    if (ISWINDOWS) {
        console.error("This function is for Unix systems only. Exiting...");
        Deno.exit(1);
    }
    await ensureDir(outputDir);

    const tarStream = (await Deno.open(inputPath))
        .readable
        .pipeThrough(new DecompressionStream("gzip"))
        .pipeThrough(new UntarStream());

    for await (const unzipped of tarStream as AsyncIterable<TarStreamEntry>) {
        const path = normalize(unzipped.path);
        console.log("extractTarGz(): Extracting ", path);
        await Deno.mkdir(dirname(path), { recursive: true });

        if (unzipped.readable) {
            await unzipped.readable.pipeTo((await Deno.create(path)).writable);
        }
    }
    console.log("extractTarGz(): Extraction complete!");
}

/**
 * Generates the download URL for the Piper TTS engine based on the current OS and architecture.
 * @throws {Error} If the current OS and architecture combination is not supported.
 * @returns {string} The complete URL to download the appropriate Piper binary.
 */
function getPiperUrl(): string {
    const baseUrl =
        `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/`;
    validateOsArch(OS, ARCH);
    return `${baseUrl}${getFileInfo(OS, ARCH)["fileName"]}`;
}

/**
 * Downloads the appropriate `piper` executable for the current operating system.
 * Saves the executable on the current directory.
 * Changes file mode to 755 (executable).
 * Adds directory containing the executable, to path
 * @throws Will throw an error if the download fails.
 */
async function installPiper(): Promise<void> {
    const url = getPiperUrl();
    const fileName = url.split("/").pop()!;
    const filePath = `${HOME}/piperTTS/`;
    const fullPathWithFile = `${filePath}${fileName}`;

    await ensureDir(filePath);

    try {
        console.log(`Downloading ${fileName} to ${filePath}...`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to download ${fileName}: ${response.statusText}`,
            );
        }

        const fileData = await response.arrayBuffer();
        await Deno.writeFile(
            `${filePath}${fileName}`,
            new Uint8Array(fileData),
        );

        // Unzip / untar file
        console.log(`Extract ${fileName}`);
        if (ISWINDOWS) {
            extractZip(fullPathWithFile, filePath); // Extract in same directory
        } else {
            extractTarGz(fullPathWithFile, filePath);
        }

        console.log(`Make ${fileName} executable...`);
        const piper = `${filePath}piper`;
        await Deno.chmod(piper, 0o755); // Make the file executable
        addToPath(filePath);
    } catch (error) {
        console.error(`installPiper(): Error, ${error}`);
        throw error;
    }
}

function main() {
    installPiper();
}

// Main
if (import.meta.main) {
    main();
}
