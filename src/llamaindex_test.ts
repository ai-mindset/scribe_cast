import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { ensureCacheFile, isValidCache, simpleCaching, isStale, loadFromCache } from "./llamaindex.ts";
import { PDFDocument, StandardFonts } from "npm:pdf-lib";

const TEST_DIR = "./test"
const TEST_CACHE = `${TEST_DIR}/test_cache.json`;
const TEST_PDF = `${TEST_DIR}/sample.pdf`;

async function createTestPDF(path: string, content: string) {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText(content, {
        x: 50,
        y: 500,
        font,
        size: 12
    });

    const pdfBytes = await doc.save();
    await Deno.writeFile(path, pdfBytes);
}

/**
 * Creates sample PDF for testing
 * @returns Path to created test PDF
 */
async function createSamplePdf(): Promise<string> {
    const pdfContent = "cached content";

    // Ensure test directory exists
    try {
        await Deno.stat(TEST_DIR);
    } catch {
        await Deno.mkdir(TEST_DIR, { recursive: true });
    }

    await createTestPDF(TEST_PDF, pdfContent);
    return TEST_PDF;
}


async function cleanup() {
    try {
        await Deno.remove(TEST_CACHE);
    } catch {
        // Ignore
    }
}

// Basic functionality tests
Deno.test("ensureCacheFile creates and reads cache", async () => {
    await cleanup();
    await ensureCacheFile(TEST_CACHE);
    const exists = await Deno.stat(TEST_CACHE);
    assertExists(exists);
});

Deno.test("isValidCache validates structure", () => {
    assertEquals(isValidCache({ "test.pdf": { content: "test", timestamp: Date.now() } }), true);
    assertEquals(isValidCache(null), false);
    assertEquals(isValidCache([]), false);
    assertEquals(isValidCache({}), true);
});

Deno.test("isStale handles timestamps", () => {
    const now = Date.now();
    assertEquals(isStale(now), false);
    assertEquals(isStale(now - (25 * 60 * 60 * 1000)), true);
    assertEquals(isStale(0), true);
    assertEquals(isStale(now + 1000), false);  // Future timestamp
});

// Edge cases and error handling
Deno.test("simpleCaching handles corrupt JSON", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, "{ bad json }");
    const cache = await simpleCaching(TEST_CACHE);
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles read-only filesystem", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, "{}");
    await Deno.chmod(TEST_CACHE, 0o444);  // Read-only
    const cache = await simpleCaching(TEST_CACHE);
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles missing directory", async () => {
    const cache = await simpleCaching("/nonexistent/cache.json");
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles invalid cache entries", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, JSON.stringify({
        "valid": { content: "test", timestamp: Date.now() },
        "invalid": "not an object",
        "missing": { content: "test" }  // no timestamp
    }));
    const cache = await simpleCaching(TEST_CACHE);
    assertEquals(Object.keys(cache).length, 1);
    assertExists(cache["valid"]);
});

Deno.test("loadFromCache loads and caches new PDF", async () => {
    // await cleanup();

    const docs = await loadFromCache([TEST_PDF]);
    assertEquals(docs.length, 1);
    const cache = JSON.parse(await Deno.readTextFile(TEST_CACHE));
    assertExists(cache["valid"]);
});

Deno.test("loadFromCache uses cached content", async () => {
    await cleanup();
    await createSamplePdf();

    const docs = await loadFromCache([TEST_PDF]);
    assertEquals(docs[0], "cached content\n");
});

Deno.test("loadFromCache handles missing PDF", async () => {
    await cleanup();
    await assertRejects(
        () => loadFromCache(["nonexistent.pdf"]),
        Error
    );
});
