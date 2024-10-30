import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { ensureCacheFile, isValidCache, readFromCache, processPDF } from "./llamaindex.ts";
import { PDFDocument, StandardFonts } from "npm:pdf-lib";

const TEST_DIR: string = "./test"
const TEST_CACHE: string = `${TEST_DIR}/test_cache.json`;
const TEST_PDF_PATH: string = `${TEST_DIR}/sample.pdf`;
const PDF_CONTENT: string = "content";

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
async function createSamplePdf(): Promise<void> {
    // Ensure test directory exists
    try {
        await Deno.stat(TEST_DIR);
    } catch {
        await Deno.mkdir(TEST_DIR, { recursive: true });
    }

    await createTestPDF(TEST_PDF_PATH, PDF_CONTENT);
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

// Edge cases and error handling
Deno.test("simpleCaching handles corrupt JSON", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, "{ bad json }");
    const cache = await readFromCache(TEST_CACHE);
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles read-only filesystem", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, "{}");
    await Deno.chmod(TEST_CACHE, 0o444);  // Read-only
    const cache = await readFromCache(TEST_CACHE);
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles missing directory", async () => {
    const cache = await readFromCache("/nonexistent/cache.json");
    assertEquals(cache, {});
});

Deno.test("simpleCaching handles invalid cache entries", async () => {
    await cleanup();
    await Deno.writeTextFile(TEST_CACHE, JSON.stringify({
        "valid": { content: "test", timestamp: Date.now() },
        "invalid": "not an object",
        "missing": { content: "test" }  // no timestamp
    }));
    const cache = await readFromCache(TEST_CACHE);
    assertEquals(Object.keys(cache).length, 1);
    assertExists(cache["valid"]);
});


Deno.test("processes valid PDF file", async () => {
    await createSamplePdf();
    const result = await processPDF(TEST_PDF_PATH);
    assertEquals(result, PDF_CONTENT);
    await Deno.remove(TEST_PDF_PATH);
});

Deno.test("returns null for non-existent file", async () => {
    const result = await processPDF("nonexistent.pdf");
    assertEquals(result, null);
});

Deno.test("throws on unexpected filesystem errors", async () => {
    // Create a problematic file that triggers permission error
    const filePath = "/root/test.pdf";

    await assertRejects(
        () => processPDF(filePath),
        Error,
        "Permission denied"
    );
});
