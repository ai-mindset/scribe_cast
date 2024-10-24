import { QdrantClient } from "npm:@qdrant/js-client-rest";

/**
 * Configuration type for Qdrant connection
 */
type QdrantConfig = {
    host: string;
    port: number;
    collection: string;
    vectorSize: number;
};

/**
 * Creates and returns a configured Qdrant client
 * @param config Configuration parameters for Qdrant
 * @returns Configured QdrantClient instance
 */
function createQdrantClient(config: QdrantConfig): QdrantClient {
    return new QdrantClient({
        url: `http://${config.host}:${config.port}`,
    });
}

/**
 * Initializes a collection in Qdrant with specified parameters
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to initialize
 * @param vectorSize Size of the vectors to store
 * @returns Promise that resolves when initialization is complete
 */
async function initializeCollection(
    client: QdrantClient,
    collectionName: string,
    vectorSize: number,
): Promise<void> {
    try {
        await client.createCollection(collectionName, {
            vectors: {
                size: vectorSize,
                distance: "Cosine",
            },
            optimizers_config: {
                default_segment_number: 2,
            },
            replication_factor: 1,
        });
    } catch (error: unknown) {
        if (!error.toString().includes("already exists")) {
            throw error;
        }
    }
}

/**
 * Stores a vector with its associated metadata in Qdrant
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to store in
 * @param vector The embedding vector to store
 * @param metadata Associated metadata including summary and file information
 * @returns The ID of the stored vector
 */
async function storeVector(
    client: QdrantClient,
    collectionName: string,
    vector: number[],
    metadata: Record<string, string>,
): Promise<string> {
    const id = crypto.randomUUID();
    await client.upsert(collectionName, {
        wait: true,
        points: [
            {
                id,
                vector,
                payload: metadata,
            },
        ],
    });
    return id;
}

/**
 * Searches for similar vectors in Qdrant
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to search in
 * @param vector The query vector
 * @param limit Maximum number of results to return
 * @returns Array of similar documents with their metadata and scores
 */
async function searchSimilar(
    client: QdrantClient,
    collectionName: string,
    vector: number[],
    limit = 5,
) // TODO: return type(s)?
{
    const results = await client.search(collectionName, {
        vector,
        limit,
        with_payload: true,
    });

    return results.map((result) => ({
        score: result.score,
        metadata: result.payload,
    }));
}

/**
 * Deletes a vector by its ID from Qdrant
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to delete from
 * @param id The vector ID to delete
 */
async function deleteVector(
    client: QdrantClient,
    collectionName: string,
    id: string,
): Promise<void> {
    await client.delete(collectionName, {
        points: [id],
        wait: true,
    });
}

/**
 * Batch stores multiple vectors with their associated metadata
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to store in
 * @param vectors Array of vectors and their metadata
 * @returns Array of generated IDs for the stored vectors
 */
async function batchStoreVectors(
    client: QdrantClient,
    collectionName: string,
    vectors: Array<{ vector: number[]; metadata: Record<string, string> }>,
): Promise<string[]> {
    const points = vectors.map((item) => ({
        id: crypto.randomUUID(),
        vector: item.vector,
        payload: item.metadata,
    }));

    await client.upsert(collectionName, {
        wait: true,
        points,
    });

    return points.map((point) => point.id as string);
}

/**
 * Performs a filtered similarity search in Qdrant
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to search in
 * @param vector The query vector
 * @param filter Filter conditions for the search
 * @param limit Maximum number of results to return
 */
async function searchSimilarWithFilter(
    client: QdrantClient,
    collectionName: string,
    vector: number[],
    filter: Record<string, string>,
    limit: number = 5,
) // TODO: return type?
{
    const results = await client.search(collectionName, {
        vector,
        filter,
        limit,
        with_payload: true,
    });

    return results.map((result) => ({
        score: result.score,
        metadata: result.payload,
    }));
}

// =======================================================================================
const config: QdrantConfig = {
    host: "localhost",
    port: 6333,
    collection: "pdf_summaries",
    vectorSize: 4096, // for avr/sfr-embedding-mistral:latest
};

async function example(): Promise<void> {
    const client = createQdrantClient(config);
    await initializeCollection(client, config.collection, config.vectorSize);

    // Store a single vector
    const vector = new Array(config.vectorSize).fill(0).map(() =>
        Math.random()
    );
    const metadata = { summary: "Example summary", fileName: "test.pdf" };
    const id = await storeVector(client, config.collection, vector, metadata);

    // Search for similar vectors
    const similarDocs = await searchSimilar(client, config.collection, vector);

    // Example with filtering
    const filteredDocs = await searchSimilarWithFilter(
        client,
        config.collection,
        vector,
        { fileName: "test.pdf" },
    );

    // Batch store example
    const batchVectors = [
        {
            vector: new Array(config.vectorSize).fill(0).map(() =>
                Math.random()
            ),
            metadata: { summary: "Doc 1" },
        },
        {
            vector: new Array(config.vectorSize).fill(0).map(() =>
                Math.random()
            ),
            metadata: { summary: "Doc 2" },
        },
    ];
    const batchIds = await batchStoreVectors(
        client,
        config.collection,
        batchVectors,
    );

    // Cleanup
    await deleteVector(client, config.collection, id);
}

// ===============================================================================
if (import.meta) {
    example();
}
