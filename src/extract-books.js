const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

// Project directories
const CACHE_DIR = path.join(__dirname, "..", "cache", "books");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// Input and output files
const URL_FILE = path.join(OUTPUT_DIR, "book-urls.json");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "raw-books.json");

// Delay helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch a book page or use its cached HTML
async function getHTML(url, bookNumber) {

    const cacheFile = path.join(
        CACHE_DIR,
        `book-${String(bookNumber).padStart(3, "0")}.html`
    );

    // Check whether the page is already cached
    try {
        const cachedHTML = await fs.readFile(cacheFile, "utf-8");

        console.log(`CACHE HIT: Book ${bookNumber}`);

        return cachedHTML;

    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    // Fetch the page if it isn't cached
    console.log(`FETCH: Book ${bookNumber}`);

    const response = await fetch(url, {
        headers: {
            "User-Agent": "FlyRankInternship-A9/1.0 (+https://github.com/heyaqeelpop/scarper)"
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
        throw new Error(
            `HTTP Error ${response.status} for ${url}`
        );
    }

    const html = await response.text();

    // Create cache directory and save HTML
    await fs.mkdir(CACHE_DIR, { recursive: true });

    await fs.writeFile(
        cacheFile,
        html,
        "utf-8"
    );

    // Wait before making the next request
    await sleep(1000);

    return html;
}

// Extract details from an individual book page
function extractBookDetails(html, bookInfo) {

    const $ = cheerio.load(html);
    const $product = $("article.product_page");

    const title = $product.find("div.product_main h1")
        .text()
        .trim();

    const price = $product.find("p.price_color")
        .first()
        .text()
        .trim();

    const availability = $product.find("p.instock.availability")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const ratingClass = $product.find("p.star-rating").first().attr("class");

    const rating = ratingClass
        ?.split(/\s+/)
        .find(value => value !== "star-rating") || null;

    const description =
        $product.find("#product_description")
            .next("p")
            .text()
            .trim() || null;

    return {
        title: title || null,
        product_url: bookInfo.product_url,
        price_text: price || null,
        availability_text: availability || null,
        rating_text: rating,
        description: description,
        source_page: bookInfo.source_page,
        fetched_at: new Date().toISOString()
    };
}

// Main function
async function main() {

    try {

        // STEP 1: Read the discovered book URLs
        const fileContent = await fs.readFile(
            URL_FILE,
            "utf-8"
        );

        const bookURLs = JSON.parse(fileContent);

        if (!Array.isArray(bookURLs) || bookURLs.length !== 60) {
            throw new Error(
                "Expected exactly 60 book URLs in book-urls.json"
            );
        }

        console.log(`Found ${bookURLs.length} book URLs.\n`);

        // STEP 2: Extract details from each book
        const allBooks = [];

        for (let i = 0; i < bookURLs.length; i++) {

            const bookInfo = bookURLs[i];
            const bookNumber = i + 1;

            console.log(
                `Processing Book ${bookNumber}/${bookURLs.length}`
            );

            const html = await getHTML(
                bookInfo.product_url,
                bookNumber
            );

            const book = extractBookDetails(
                html,
                bookInfo
            );

            if (!book.title || !book.price_text) {
                throw new Error(
                    `Missing required details for Book ${bookNumber}`
                );
            }

            allBooks.push(book);
        }

        // STEP 3: Save extracted data
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(allBooks, null, 2),
            "utf-8"
        );

        console.log("\n------------------------------");
        console.log("EXTRACTION COMPLETED");
        console.log("------------------------------");

        console.log("Total books extracted:", allBooks.length);
        console.log(`detail_pages=${allBooks.length}`);
        console.log("\nSample record:");
        console.log(JSON.stringify(allBooks[0], null, 2));
        console.log("Output file: output/raw-books.json");

    } catch (error) {

        console.error("\nExtraction failed:", error.message);

    }
}

main();