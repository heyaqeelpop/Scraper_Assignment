const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");
const { getHTML } = require("./fetcher");

const CACHE_DIR = path.join(__dirname, "..", "cache", "books");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const URL_FILE = path.join(OUTPUT_DIR, "book-urls.json");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "raw-books.json");

// Extract details from an individual book page
function extractBookDetails(html, bookInfo) {
    const $ = cheerio.load(html);
    const $product = $("article.product_page");

    const title = $product.find("div.product_main h1").text().trim();

    const price = $product.find("p.price_color").first().text().trim();

    const availability = $product
        .find("p.instock.availability")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const ratingClass = $product.find("p.star-rating").first().attr("class");

    const rating = ratingClass
        ?.split(/\s+/)
        .find(value => value !== "star-rating") || null;

    const description =
        $product.find("#product_description").next("p").text().trim() || null;

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

// Each book is handled separately: one bad page is logged and skipped
async function extract(bookURLs) {
    const books = [];
    const failed = [];

    for (let i = 0; i < bookURLs.length; i++) {
        const bookInfo = bookURLs[i];
        const bookNumber = i + 1;

        console.log(`Processing Book ${bookNumber}/${bookURLs.length}`);

        try {
            const html = await getHTML(
                bookInfo.product_url,
                path.join(
                    CACHE_DIR,
                    `book-${String(bookNumber).padStart(3, "0")}.html`
                ),
                `Book ${bookNumber}`
            );

            const book = extractBookDetails(html, bookInfo);

            if (!book.title || !book.price_text) {
                throw new Error("Missing title or price on page");
            }

            books.push(book);
        } catch (error) {
            console.error(`FAILED: Book ${bookNumber} - ${error.message}`);
            failed.push({
                product_url: bookInfo.product_url,
                error: error.message
            });
        }
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(books, null, 2), "utf-8");

    console.log(`detail_pages=${books.length} failed_pages=${failed.length}`);
    if (books.length) {
        console.log("Sample record:");
        console.log(JSON.stringify(books[0], null, 2));
    }

    return { books, failed };
}

module.exports = { extract };

if (require.main === module) {
    fs.readFile(URL_FILE, "utf-8")
        .then(content => extract(JSON.parse(content)))
        .catch(error => {
            console.error("Extraction failed:", error.message);
            process.exit(1);
        });
}