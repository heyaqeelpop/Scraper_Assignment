const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { extractBookDetails } = require("../src/extract-books");
const { extractBookLinks } = require("../src/discover-pages");
const {
    parsePrice,
    cleanDescription,
    normalize,
    dedupeByUrl,
    validateRecords
} = require("../src/clean-books");
const { toCell, toCSV } = require("../src/export-csv");
const { diffSnapshots, hashRecord } = require("../src/detect-changes");
const { esc } = require("../src/build-dashboard");

const fixture = name =>
    fs.readFileSync(path.join(__dirname, "fixtures", name), "utf-8");

const BOOK_INFO = {
    product_url: "https://books.toscrape.com/catalogue/x_1/index.html",
    source_page: "https://books.toscrape.com/catalogue/page-1.html"
};

// ---------- 1. price normalization ----------
test("price normalization: pounds text becomes a number", () => {
    assert.equal(parsePrice("£51.77"), 51.77);
    assert.equal(parsePrice("£1,234.50"), 1234.5);
    assert.equal(parsePrice("  £5.00 "), 5);
    assert.equal(parsePrice("free"), null);
    assert.equal(parsePrice(null), null);
});

// ---------- 2. relative -> absolute URLs ----------
test("relative links become absolute URLs", () => {
    const links = extractBookLinks(
        fixture("catalogue-sample.html"),
        "https://books.toscrape.com/catalogue/page-1.html"
    );

    assert.equal(
        links[0],
        "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    );
    // "../" is resolved by the URL tools, not by gluing strings
    assert.equal(
        links[1],
        "https://books.toscrape.com/other-book_999/index.html"
    );
    assert.ok(links.every(l => l.startsWith("https://")));
});

// ---------- 3. missing description ----------
test("missing description is null, never invented", () => {
    const book = extractBookDetails(
        fixture("book-missing-description.html"),
        BOOK_INFO
    );

    assert.equal(book.description, null);
    assert.equal(book.title, "No Blurb Book");
    assert.equal(Object.keys(book).length, 8); // all eight keys still present
});

// ---------- 4. duplicate URLs ----------
test("duplicate URLs count once", () => {
    const records = [
        { product_url: "https://a/1" },
        { product_url: "https://a/2" },
        { product_url: "https://a/1" }
    ];
    const { unique, duplicates } = dedupeByUrl(records);

    assert.equal(unique.length, 2);
    assert.equal(duplicates, 1);
});

test("discovery sees the duplicate link on a catalogue page", () => {
    const links = extractBookLinks(
        fixture("catalogue-sample.html"),
        "https://books.toscrape.com/catalogue/page-1.html"
    );
    assert.equal(links.length, 3);
    assert.equal(new Set(links).size, 2);
});

// ---------- 5. malformed fixture ----------
test("malformed page gives null fields and fails validation with reasons", () => {
    const book = extractBookDetails(fixture("book-malformed.html"), BOOK_INFO);

    assert.equal(book.title, null);
    assert.equal(book.price_text, null);

    const { valid, errors } = validateRecords([normalize(book)]);
    assert.equal(valid.length, 0);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].reasons.length > 0);
});

// ---------- 6. extra whitespace + scoping ----------
test("extra whitespace is collapsed", () => {
    const book = extractBookDetails(
        fixture("book-extra-whitespace.html"),
        BOOK_INFO
    );

    assert.equal(book.title, "Spaced Out Book");
    assert.equal(book.availability_text, "In stock (22 available)");
    assert.equal(book.price_text, "£1,234.50");
    assert.equal(parsePrice(book.price_text), 1234.5);
    // raw extraction keeps the text; the cleaning step collapses spaces
    assert.equal(normalize(book).description, "The full text.");
});

test("selectors ignore the related-products block", () => {
    const book = extractBookDetails(
        fixture("book-extra-whitespace.html"),
        BOOK_INFO
    );

    // Related block has price £5.00, rating One and extra "In stock" lines
    assert.equal(book.price_text, "£1,234.50");
    assert.equal(book.rating_text, "Three");
    assert.ok(!/In stock In stock/.test(book.availability_text));
});

// ---------- 7. description cleanup ----------
test("description: truncated copy and '...more' are removed", () => {
    const full = "It was the best of times, it was the worst of times, it was the age of wisdom.";
    const truncated = full.slice(0, 50);
    const messy = `${truncated} ${full} ...more`;

    assert.equal(cleanDescription(messy), full);
    assert.equal(cleanDescription("Short text ...more"), "Short text");
    assert.equal(cleanDescription(null), null);
    assert.equal(cleanDescription("   "), null);
});

// ---------- 8. CSV flattening ----------
test("csv: commas, quotes, newlines and nulls are flattened safely", () => {
    assert.equal(toCell(null), "");
    assert.equal(toCell("plain"), "plain");
    assert.equal(toCell("a, b"), '"a, b"');
    assert.equal(toCell('say "hi"'), '"say ""hi"""');
    assert.equal(toCell("line1\nline2"), "line1 line2");

    const csv = toCSV([{ title: "T", description: null, price_gbp: 1.5 }]);
    const [header, row] = csv.trim().split("\r\n");
    assert.ok(header.startsWith("title,product_url"));
    assert.ok(row.startsWith("T,,"));
});

// ---------- 9. change detection ----------
test("change detection: new, changed, unchanged, gone, not_checked", () => {
    const rec = (url, price) => ({
        product_url: url,
        price_gbp: price,
        fetched_at: "2026-01-01T00:00:00Z"
    });

    const previous = {
        "https://a/same": hashRecord(rec("https://a/same", 1)),
        "https://a/edit": hashRecord(rec("https://a/edit", 1)),
        "https://a/gone": "x",
        "https://a/failed": "y"
    };

    const current = [
        { ...rec("https://a/same", 1), fetched_at: "2027-05-05T00:00:00Z" },
        rec("https://a/edit", 2),
        rec("https://a/brandnew", 3)
    ];

    const { result, nextSnapshot } = diffSnapshots(previous, current, [
        "https://a/failed"
    ]);

    assert.deepEqual(result, {
        new: 1,
        changed: 1,
        unchanged: 1, // fetched_at alone does not count as a change
        gone: 1,
        not_checked: 1
    });
    assert.equal(nextSnapshot["https://a/failed"], "y"); // knowledge kept
    assert.ok(!("https://a/gone" in nextSnapshot));
});

// ---------- 10. dashboard escaping ----------
test("dashboard escapes scraped text", () => {
    assert.equal(
        esc('<script>alert("x")</script>'),
        "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
});