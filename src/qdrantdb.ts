import { CONFIG, QdrantClient, vectorStore } from "./deps.ts";

/**
 * initialises a collection in Qdrant with specified parameters
 * @param client QdrantClient instance
 * @param collectionName Name of the collection to initialise
 * @param vectorSize Size of the vectors to store
 * @returns Promise that resolves when initialization is complete
 */
async function initialiseCollection(
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
) {
    // TODO: return type(s)?
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
) {
    // TODO: return type?
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
async function example(): Promise<void> {
    await initialiseCollection(
        vectorStore,
        CONFIG.COLLECTION_NAME,
        CONFIG.VECTOR_SIZE,
    );

    // Store a single vector
    const vector = new Array(CONFIG.VECTOR_SIZE).fill(0).map(() =>
        Math.random()
    );
    const metadata = { summary: "Example summary", fileName: "test.pdf" };
    const id = await storeVector(
        vectorStore,
        CONFIG.COLLECTION_NAME,
        vector,
        metadata,
    );
    concole.log(
        `Vector of length ${vector.length}, with metadata ${metadata} and ID ${id} was stored in collection`,
    );

    // Search for similar vectors
    const similarDocs = await searchSimilar(
        vectorStore,
        CONFIG.COLLECTION_NAME,
        vector,
    );
    console.log(`Similar doc(s): ${similarDocs}`);

    // Example with filtering
    const filteredDocs = await searchSimilarWithFilter(
        vectorStore,
        CONFIG.COLLECTION_NAME,
        vector,
        { fileName: "test.pdf" },
    );
    console.log(`Filtered doc(s): ${filteredDocs}`);

    // Batch store example
    const batchVectors = [
        {
            vector: new Array(CONFIG.VECTOR_SIZE).fill(0).map(() =>
                Math.random()
            ),
            metadata: { summary: "Doc 1" },
        },
        {
            vector: new Array(CONFIG.VECTOR_SIZE).fill(0).map(() =>
                Math.random()
            ),
            metadata: { summary: "Doc 2" },
        },
    ];
    const batchIds = await batchStoreVectors(
        vectorStore,
        CONFIG.COLLECTION_NAME,
        batchVectors,
    );
    console.log(`Batch vectors ${batchVectors} with IDs ${batchIds}`);

    // Cleanup
    await deleteVector(vectorStore, CONFIG.COLLECTION_NAME, id);

    console.log(`Vector with id ${id} was deleted`);
}

// ===============================================================================
if (import.meta) {
    example();
}
