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
 * @param cachePath - Optional custom path for cache file. Defaults to CONFIG.PARSING_CACHE
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

// /**
// * Type guard ensuring data is a non-null object (not array)
// */
// export function isValidCache(data: unknown): data is ParseCache {
//     return (
//         data !== null &&
//         typeof data === "object" &&
//         !Array.isArray(data)
//     );
// }

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
 * @throws {Error} If cache file exists but is invalid/corrupt
 */
export async function simpleCaching(cachePath?: string): Promise<ParseCache> {
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
 * Checks if cached data is older than 24 hours
 */
export function isStale(timestamp: number): boolean {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > ONE_DAY;
}

/**
 * Loads and caches PDF documents locally, using unpdf
 * @throws {Error} If PDF reading or parsing fails
 */
export async function loadFromCache(filesToParse: string[]): Promise<string[]> {
    const cache: ParseCache = await simpleCaching();
    const documents: string[] = [];
    const { getDocument } = await getResolvedPDFJS();

    try {
        for (const f of filesToParse) {
            const fullPath = f.split("/");
            const file = fullPath[fullPath.length - 1].split(".pdf")[0];
            if (!cache[file]) {
                const pdfBytes = await Deno.readFile(f);
                const doc = await getDocument(pdfBytes).promise;
                const { text } = await extractText(doc, { mergePages: true });
                const content = text;

                cache[file] = { content, timestamp: Date.now() };
            } else {
                const cached = cache[file];
                if (isValidCache(cached)) {
                    documents.push(cached.content);
                } else {
                    const pdfBytes = await Deno.readFile(f);
                    const doc = await getDocument(pdfBytes).promise;
                    let content = "";

                    for (let i = 1; i <= doc.numPages; i++) {
                        const page = await doc.getPage(i);
                        const textContent = await page.getTextContent();
                        content += textContent.items.map((item) =>
                            item.str
                        ).join(" ") + "\n";
                    }

                    documents.push(content);
                    cache[f] = { content, timestamp: Date.now() };
                }
            }
        }

        await Deno.writeTextFile(CONFIG.PARSING_CACHE, JSON.stringify(cache));
        return documents;
    } catch (error) {
        console.error("Failed to load or parse documents:", error);
        throw error;
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
    const filesToParse = ["./data/1706.03762.pdf", "./data/2410.16928.pdf"];
    await loadFromCache(filesToParse);
}
