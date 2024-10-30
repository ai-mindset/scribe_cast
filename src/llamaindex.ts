import {
    CONFIG,
    Document,
    extractImages,
    extractText,
    getResolvedPDFJS,
    QdrantVectorStore,
    VectorStoreIndex,
} from "./deps.ts";

interface ParseCache {
    [filePath: string]: {
        content: string;
        timestamp: number;
    };
}

/**
 * Ensures cache file exists, creates if missing
 * @param cachePath - Custom path for cache file
 * @throws {Error} If directory creation or file access fails
 */
export async function ensureCacheFile(cachePath: string): Promise<void> {
    try {
        await Deno.stat(cachePath);
        console.log(`${cachePath} exists`);
    } catch {
        await Deno.writeTextFile(cachePath, "{}");
        console.log(`Created ${cachePath}`);
    }
}

/**
 * Type guard validating cache entries match ParseCache structure
 * @param data - Unknown data to validate
 * @returns True if data contains at least one valid entry
 */
export function isValidCache(data: unknown): data is ParseCache {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return false;
    }

    // Check if at least one entry is valid
    return Object.entries(data).some(([_key, value]) =>
        value &&
        typeof value === "object" &&
        "content" in value &&
        "timestamp" in value &&
        typeof value.content === "string" &&
        typeof value.timestamp === "number"
    );
}

/**
 * Retrieves and validates cached parsing data from filesystem.
 * @param cachePath - Optional custom path for cache file. Defaults to CONFIG.PARSING_CACHE
 * @returns ParseCache object with cached PDF content
 * @throws {Error} If cache file exists but is invalid/corrupt
 */
export async function readFromCache(cachePath?: string): Promise<ParseCache> {
    const cache: ParseCache = {};
    const path = cachePath || CONFIG.PARSING_CACHE;

    try {
        await ensureCacheFile(path);
        const rawData = await Deno.readTextFile(path);
        const parsed = JSON.parse(rawData);

        if (isValidCache(parsed)) {
            // Keep only valid entries
            Object.entries(parsed).forEach(([key, value]) => {
                if (
                    value &&
                    typeof value === "object" &&
                    "content" in value &&
                    "timestamp" in value &&
                    typeof value.content === "string" &&
                    typeof value.timestamp === "number"
                ) {
                    cache[key] = value;
                }
            });
        }
        return cache;
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error("Cache corrupted:", error.message);
        } else {
            console.error("Cache error:", error);
        }
        return cache;
    }
}

/**
 * Saves content to cache file, creating new cache if none exists
 * @param cachePath - Path to cache file
 * @param filePath - PDF file path to use as cache key
 * @param content - Text content to cache
 * @throws {Error} If cache file operations fail
 */
export async function saveToCache(
    cachePath: string,
    filePath: string,
    content: string
): Promise<void> {
    let cache: ParseCache = {};

    try {
        const existing = await Deno.readTextFile(cachePath);
        cache = JSON.parse(existing);
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }

    cache[filePath] = {
        content,
        timestamp: Date.now()
    };

    await Deno.writeTextFile(cachePath, JSON.stringify(cache));
}

/**
 * Extracts text from a PDF file
 * @param filePath Path to the PDF file
 * @param cache Current cache object
 * @returns Extracted text or null if file doesn't exist
 */
export async function processPDF(
    filePath: string,
): Promise<string> {

    const { getDocument } = await getResolvedPDFJS();
    try {
        // Check if file exists
        await Deno.stat(filePath);
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            console.error(`PDF file not found: ${filePath}`);
            return "";
        }
        throw error;
    }

    // Extract text from PDF
    try {
        const pdfBytes = await Deno.readFile(filePath);
        const doc = await getDocument(pdfBytes).promise;
        const { text } = await extractText(doc, { mergePages: true });

        return text;
    } catch (error) {
        console.error(`Failed to process PDF ${filePath}:`, error);
        return "";
    }
}






// async function temp() {
//     const pathFile = "node_modules/llamaindex/examples/abramov.txt";

//     import fs from "node:fs/promises";
//     const essay = await fs.readFile(pathFile, "utf-8");

//     const vectorStore = new QdrantVectorStore({
//         url: `${CONFIG.LOCALHOST}:${CONFIG.QDRANT_PORT}`,
//     });

//     const document = new Document({ text: essay, id_: pathFile });

//     const index = await VectorStoreIndex.fromDocuments([document], {
//         vectorStore,
//     });

//     const queryEngine = index.asQueryEngine();

//     const response = await queryEngine.query({
//         query: "What did the author do in college?",
//     });

//     // Output response
//     console.log(response.toString());
// }

if (import.meta) {
    const files: Array<string> = ["./data/1706.03762.pdf", "./data/2410.16928.pdf"];
    const fileNames: Array<string> = files.map(path => path.split('/').pop()?.split('.pdf')[0] ?? '');
    const cache = "./data/cache.json";
    const text = await processPDF(files[1]);
    saveToCache(cache, fileNames[0], text)
}
