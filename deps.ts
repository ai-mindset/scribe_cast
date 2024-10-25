export {
    Document,
    LlamaParseReader,
    QdrantVectorStore,
    VectorStoreIndex,
} from "llamaindex";
import { Ollama, OllamaEmbedding, Settings } from "llamaindex";

import { QdrantClient } from "@qdrant/js-client-rest";

// Third-party imports
export { extractText, getDocumentProxy } from "unpdf";

export { Application, Router } from "@oak/oak";

export { assertEquals, assertExists, assertRejects } from "@std/assert";

export { parse } from "@std/flags";

export { MockError, mockSession, mockSessionAsync } from "@std/testing/mock";

// Shared configurations
export const CONFIG = {
    LOCALHOST: "http://localhost",
    QDRANT_PORT: "6333",
    OLLAMA_PORT: "11434",
    MAX_BATCH_SIZE: 5,
    COLLECTION_NAME: "summaries",
    VECTOR_SIZE: 4096,
    STREAM: true,
    PARSING_CACHE: "./cache.json", // https://github.com/run-llama/ts-agents/blob/main/5_qdrant/agent.ts
} as const;

// Shared types
export type ProcessingResult = {
    summary: string;
    error?: string;
};

// Shared utilities
export function createLogger(module: string) {
    return {
        info: (msg: string) => console.log(`[${module}] ${msg}`),
        error: (msg: string) => console.error(`[${module}] ERROR: ${msg}`),
        debug: (msg: string) => console.debug(`[${module}] DEBUG: ${msg}`),
    };
}

// Shared instances (initialize once, use everywhere)
export const vectorStore = new QdrantClient({
    url: `${CONFIG.LOCALHOST}:${CONFIG.QDRANT_PORT}`,
});

// Shared LLMs
Settings.embedModel = new OllamaEmbedding({
    model: "avr/sfr-embedding-mistral:latest",
});
Settings.llm = new Ollama({
    model: "mistral-nemo:latest",
    config: {
        host: `${CONFIG.LOCALHOST}:${CONFIG.OLLAMA_PORT}`,
    },
});
Settings.callbackManager.on("llm-tool-call", (event) => {
    console.log(event.detail);
});
Settings.callbackManager.on("llm-tool-result", (event) => {
    console.log(event.detail);
});
