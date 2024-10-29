import { parse } from ".deps.ts";
import { PDFProcessor } from "./pdf_processor.ts";

type ProcessResult = {
    source: string;
    summary?: string;
    error?: string;
};

async function main() {
    const flags = parse(Deno.args, {
        string: ["urls", "files"],
        alias: { u: "urls", f: "files" },
    });

    if (!flags.urls && !flags.files) {
        console.error(`Usage:
    Process URLs:    deno run --allow-net --allow-read cli.ts -u "url1,url2,..."
    Process Files:   deno run --allow-net --allow-read cli.ts -f "path1,path2,..."`);
        Deno.exit(1);
    }

    const vectorStore = new QdrantStore();
    const processor = new PDFProcessor(vectorStore);
    let results: ProcessResult[] = [];

    try {
        if (flags.urls) {
            const urls = flags.urls.split(",").slice(0, 5);
            console.log(`Processing ${urls.length} URLs...`);
            results = await Promise.all(
                urls.map(async (url: string): Promise<ProcessResult> => {
                    try {
                        const text = await processor.processURLPDF(url);
                        const summary = await processor.generateSummary(text);
                        return { source: url, summary };
                    } catch (error) {
                        return { source: url, error: error.message };
                    }
                }),
            );
        }

        if (flags.files) {
            const files = flags.files.split(",").slice(0, 5);
            console.log(`Processing ${files.length} files...`);
            results = await Promise.all(
                files.map(async (path: string): Promise<ProcessResult> => {
                    try {
                        const data = await Deno.readFile(path);
                        const text = await processor.processPDFData(data);
                        const summary = await processor.generateSummary(text);
                        return { source: path, summary };
                    } catch (error) {
                        return { source: path, error: error.message };
                    }
                }),
            );
        }

        // Display results
        results.forEach(({ source, summary, error }) => {
            console.log("\n-----------------------------------");
            console.log(`Source: ${source}`);
            if (error) {
                console.error(`Error: ${error}`);
            } else {
                console.log(`Summary: ${summary}`);
            }
        });
    } catch (error) {
        console.error("Processing failed:", error.message);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await main();
}
