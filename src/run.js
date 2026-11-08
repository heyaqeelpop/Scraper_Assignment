const fs = require("fs/promises");
const path = require("path");
const { discover } = require("./discover-pages");
const { extract } = require("./extract-books");
const { clean } = require("./clean-books");
const { stats } = require("./fetcher");

const REPORT_FILE = path.join(__dirname, "..", "output", "run-report.json");

async function main() {
    const startedAt = new Date();
    const report = {
        started_at: startedAt.toISOString(),
        duration_seconds: null,
        pages_fetched: 0,
        cache_hits: 0,
        retries: 0,
        valid_records: 0,
        invalid_records: 0,
        failed_pages: 0,
        failures: [],
        fatal_error: null
    };

    try {
        const { bookURLs } = await discover();

        // Failure test: add one made-up book URL (your side only, not hammering)
        if (process.argv.includes("--inject-bad-url")) {
            bookURLs.push({
                product_url:
                    "https://books.toscrape.com/catalogue/this-book-does-not-exist_99999/index.html",
                source_page: "https://books.toscrape.com/catalogue/page-3.html"
            });
            console.log("TEST MODE: injected one made-up book URL");
        }

        const { failed } = await extract(bookURLs);
        const cleaned = await clean();

        report.valid_records = cleaned.valid;
        report.invalid_records = cleaned.invalid;
        report.failed_pages = failed.length;
        report.failures = failed;
    } catch (error) {
        // Even a fatal error still gets reported
        report.fatal_error = error.message;
        console.error("Run failed:", error.message);
        process.exitCode = 1;
    } finally {
        report.duration_seconds = Number(
            ((Date.now() - startedAt.getTime()) / 1000).toFixed(2)
        );
        report.pages_fetched = stats.pagesFetched;
        report.cache_hits = stats.cacheHits;
        report.retries = stats.retries;

        await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
        await fs.writeFile(
            REPORT_FILE,
            JSON.stringify(report, null, 2),
            "utf-8"
        );

        console.log("\n--- RUN REPORT ---");
        console.log(JSON.stringify(report, null, 2));
    }
}

main();