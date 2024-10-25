import fs from "node:fs/promises";
import {
    CONFIG,
    Document,
    LlamaParseReader,
    QdrantVectorStore,
    VectorStoreIndex,
} from "../deps.ts";

// load cache.json and parse it
async function simpleCaching() {
    let cache = {};
    let cacheExists = false;
    try {
        await fs.access(CONFIG.PARSING_CACHE, fs.constants.F_OK);
        cacheExists = true;
    } catch (_e) {
        console.log("No cache found");
    }
    if (cacheExists) {
        cache = JSON.parse(await fs.readFile(CONFIG.PARSING_CACHE, "utf-8"));
    }

    return cache;
}

// FIXME
async function loadFromCache() {
    const filesToParse = ["./data/1706.03762.pdf", "./data/2410.16928.pdf"];
    const cache = await simpleCaching();

    // load our data, reading only files we haven't seen before
    let documents = [];
    const reader = new LlamaParseReader({ resultType: "markdown" });
    for (let file of filesToParse) {
        if (!cache[file]) {
            documents = documents.concat(await reader.loadData(file));
            cache[file] = true;
        }
    }

    // write the cache back to disk
    await fs.writeFile(CONFIG.PARSING_CACHE, JSON.stringify(cache));
}

const path = "node_modules/llamaindex/examples/abramov.txt";
const essay = await fs.readFile(path, "utf-8");

const vectorStore = new QdrantVectorStore({
    url: `${CONFIG.LOCALHOST}:${CONFIG.QDRANT_PORT}`,
});

const document = new Document({ text: essay, id_: path });

const index = await VectorStoreIndex.fromDocuments([document], {
    vectorStore,
});

const queryEngine = index.asQueryEngine();

const response = await queryEngine.query({
    query: "What did the author do in college?",
});

// Output response
console.log(response.toString());
