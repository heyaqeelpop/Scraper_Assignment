const fs = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://books.toscrape.com/catalogue/";
const CACHE_DIR = path.join(__dirname, "..", "cache");

async function getHTML(url, pageNumber) {
    const cacheFile = path.join(
        CACHE_DIR,
        `catalogue-page-${pageNumber}.html`
    );

    try {
        const cachedHTML = await fs.readFile(cacheFile, "utf-8");
        console.log(`CACHE HIT: Page ${pageNumber}`);
        return cachedHTML;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    console.log(`FETCH: Page ${pageNumber}`);

    const response = await fetch(url, {
        headers: {
            "User-Agent": "FlyRankInternship-A9/1.0"
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const html = await response.text();

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, html, "utf-8");

    return html;
}

async function main() {
    try {
        const cataloguePages = [
            "https://books.toscrape.com/catalogue/page-1.html"
        ];

        // STEP 1: Discover three catalogue pages
        while (cataloguePages.length < 3) {
            const currentPage = cataloguePages[cataloguePages.length - 1];

            const html = await getHTML(
                currentPage,
                cataloguePages.length
            );

            const $ = cheerio.load(html);

            const nextHref = $("li.next a").attr("href");

            if (!nextHref) {
                break;
            }

            const nextPage = new URL(nextHref, currentPage).href;

            cataloguePages.push(nextPage);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Fetch the final discovered page if necessary
        if (cataloguePages.length === 3) {
            await getHTML(cataloguePages[2], 3);
        }

        console.log("\nDiscovered pages:", cataloguePages.length);

        // STEP 2: Extract book URLs from all three pages
        const allBookURLs = [];

        for (let i = 0; i < cataloguePages.length; i++) {
            const pageNumber = i + 1;

            const html = await getHTML(
                cataloguePages[i],
                pageNumber
            );

            const $ = cheerio.load(html);

            $("article.product_pod h3 a").each((index, element) => {
                const href = $(element).attr("href");

                if (href) {
                    const absoluteURL = new URL(
                        href,
                        BASE_URL
                    ).href;

                    allBookURLs.push(absoluteURL);
                }
            });

            console.log(
                `Page ${pageNumber}: ${$("article.product_pod h3 a").length} books`
            );
        }

        // STEP 3: Remove duplicate URLs
        const uniqueBookURLs = [...new Set(allBookURLs)];

        // STEP 4: Display results
        console.log("\nTotal URLs:", allBookURLs.length);
        console.log("Unique URLs:", uniqueBookURLs.length);

        console.log("\nAll Book URLs:");

        uniqueBookURLs.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });

        // STEP 5: Validate expected result
        if (uniqueBookURLs.length !== 60) {
            throw new Error(
                `Expected 60 unique URLs, found ${uniqueBookURLs.length}`
            );
        }

        console.log("\nSUCCESS: All 60 unique book URLs discovered!");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

main();