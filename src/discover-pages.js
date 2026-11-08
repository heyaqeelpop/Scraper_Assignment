const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");
const { getHTML } = require("./fetcher");

const FIRST_PAGE = "https://books.toscrape.com/catalogue/page-1.html";
const CACHE_DIR = path.join(__dirname, "..", "cache");
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "book-urls.json");

async function discover() {
    const cataloguePages = [];
    const allBooks = [];
    let pageUrl = FIRST_PAGE;

    for (let n = 1; n <= 3; n++) {
        const html = await getHTML(
            pageUrl,
            path.join(CACHE_DIR, `catalogue-page-${n}.html`),
            `Catalogue page ${n}`
        );

        const $ = cheerio.load(html);
        cataloguePages.push(pageUrl);

        $("article.product_pod h3 a").each((i, element) => {
            const href = $(element).attr("href");
            if (href) {
                allBooks.push({
                    product_url: new URL(href, pageUrl).href,
                    source_page: pageUrl
                });
            }
        });

        // Let the site tell us where the next page is
        if (n < 3) {
            const nextHref = $("li.next a").attr("href");
            if (!nextHref) break;
            pageUrl = new URL(nextHref, pageUrl).href;
        }
    }

    // Remove duplicate URLs
    const uniqueBooks = [
        ...new Map(allBooks.map(b => [b.product_url, b])).values()
    ];

    console.log(
        `catalogue_pages=${cataloguePages.length} ` +
        `discovered=${allBooks.length} unique_urls=${uniqueBooks.length}`
    );

    if (cataloguePages.length !== 3 || uniqueBooks.length !== 60) {
        throw new Error(
            `Expected 3 pages and 60 unique URLs, got ` +
            `${cataloguePages.length} and ${uniqueBooks.length}`
        );
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(
        OUTPUT_FILE,
        JSON.stringify(uniqueBooks, null, 2),
        "utf-8"
    );

    return { cataloguePages, bookURLs: uniqueBooks };
}

module.exports = { discover };

if (require.main === module) {
    discover().catch(error => {
        console.error("Discovery failed:", error.message);
        process.exit(1);
    });
}