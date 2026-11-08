const fs = require("fs/promises");
const path = require("path");
const { z } = require("zod");

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const INPUT_FILE = path.join(OUTPUT_DIR, "raw-books.json");
const BOOKS_FILE = path.join(OUTPUT_DIR, "books.json");
const ERRORS_FILE = path.join(OUTPUT_DIR, "errors.json");

// Schema of a finished record
const BookSchema = z.object({
    title: z.string().min(1),
    product_url: z.url().refine(u => u.startsWith("https://"), {
        message: "product_url must start with https://"
    }),
    price_text: z.string().min(1),
    price_gbp: z.number().positive(),
    availability_text: z.string().min(1),
    rating_text: z.string().min(1),
    description: z.string().nullable(),
    source_page: z.url(),
    fetched_at: z.iso.datetime()
});

// "£51.77" -> 51.77 (null if it can't be parsed)
function parsePrice(priceText) {
    if (typeof priceText !== "string") return null;
    const match = priceText.replace(/,/g, "").match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
}

// The site's description often holds a truncated copy followed by the full
// text, and ends with a "...more" toggle. Remove both.
function cleanDescription(text) {
    if (typeof text !== "string") return null;

    let d = text.replace(/\s*\.\.\.more\s*$/, "").replace(/\s+/g, " ").trim();
    if (!d) return null;

    // If the first 40 characters appear again later, and everything before
    // that second occurrence is a prefix of the rest, it's a truncated copy.
    const probe = d.slice(0, 40);
    const second = d.indexOf(probe, 1);
    if (second > 0) {
        const head = d.slice(0, second).trim();
        const rest = d.slice(second);
        if (rest.startsWith(head)) {
            d = rest.trim();
        }
    }
    return d || null;
}

function normalize(raw) {
    return {
        title: raw.title,
        product_url: raw.product_url,
        price_text: raw.price_text,
        price_gbp: parsePrice(raw.price_text),
        availability_text: raw.availability_text,
        rating_text: raw.rating_text,
        description: cleanDescription(raw.description),
        source_page: raw.source_page,
        fetched_at: raw.fetched_at
    };
}

async function clean() {
    const rawBooks = JSON.parse(await fs.readFile(INPUT_FILE, "utf-8"));

    const seen = new Set();
    const valid = [];
    const errors = [];
    let duplicates = 0;

    for (const raw of rawBooks) {
        const record = normalize(raw);

        // product_url is the identity: same book twice counts once
        if (seen.has(record.product_url)) {
            duplicates++;
            continue;
        }

        const result = BookSchema.safeParse(record);

        if (result.success) {
            seen.add(record.product_url);
            valid.push(result.data);
        } else {
            errors.push({
                product_url: raw.product_url ?? null,
                reasons: result.error.issues.map(
                    i => `${i.path.join(".") || "(record)"}: ${i.message}`
                ),
                record: raw
            });
        }
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(BOOKS_FILE, JSON.stringify(valid, null, 2), "utf-8");
    await fs.writeFile(ERRORS_FILE, JSON.stringify(errors, null, 2), "utf-8");

    console.log(`raw_records=${rawBooks.length}`);
    console.log(`valid_records=${valid.length}`);
    console.log(`invalid_records=${errors.length}`);
    console.log(`duplicates_skipped=${duplicates}`);

    return {
        rawCount: rawBooks.length,
        valid: valid.length,
        invalid: errors.length,
        duplicates
    };
}

module.exports = { clean };

if (require.main === module) {
    clean().catch(error => {
        console.error("Cleaning failed:", error.message);
        process.exit(1);
    });
}