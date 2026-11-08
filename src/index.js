const fs = require("fs/promises");
const path = require("path");

const URL = "https://books.toscrape.com/catalogue/page-1.html";

const CACHE_DIR = path.join(__dirname, "..", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "catalogue-page-1.html");

async function main() {
    try {
        // Check whether cached HTML already exists
        try {
            const cachedHTML = await fs.readFile(CACHE_FILE, "utf-8");

            console.log("CACHE HIT");
            console.log("Response size:", Buffer.byteLength(cachedHTML), "bytes");

            return;
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }

        // No cache exists, so fetch the webpage
        console.log("FETCH");
        console.log("Downloading:", URL);

        const response = await fetch(URL, {
            headers: {
                "User-Agent": "FlyRankInternship-A9/1.0"
            },
            signal: AbortSignal.timeout(8000)
        });

        // Check HTTP status before processing
        if (response.status !== 200) {
            throw new Error(`Request failed with status: ${response.status}`);
        }

        // Read HTML response
        const html = await response.text();

        // Create cache directory if it doesn't exist
        await fs.mkdir(CACHE_DIR, { recursive: true });

        // Save HTML locally
        await fs.writeFile(CACHE_FILE, html, "utf-8");

        console.log("HTML saved successfully!");
        console.log("Response size:", Buffer.byteLength(html), "bytes");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();