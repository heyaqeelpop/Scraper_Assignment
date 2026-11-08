const fs = require("fs/promises");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const CSV_FILE = path.join(OUTPUT_DIR, "books.csv");

const COLUMNS = [
    "title",
    "product_url",
    "price_text",
    "price_gbp",
    "availability_text",
    "rating_text",
    "description",
    "source_page",
    "fetched_at"
];

// Flattening rules (CSV has no null and no line breaks inside a cell):
//  - null / undefined  -> empty cell
//  - line breaks       -> a single space
//  - commas, quotes    -> cell wrapped in quotes, inner quotes doubled
function toCell(value) {
    if (value === null || value === undefined) return "";

    const text = String(value).replace(/\s*[\r\n]+\s*/g, " ");

    return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCSV(records) {
    const lines = [COLUMNS.join(",")];

    for (const record of records) {
        lines.push(COLUMNS.map(column => toCell(record[column])).join(","));
    }

    return lines.join("\r\n") + "\r\n";
}

async function exportCSV(records) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // The BOM makes Excel read the file as UTF-8 (so £ displays correctly)
    await fs.writeFile(CSV_FILE, "\uFEFF" + toCSV(records), "utf-8");

    console.log(`csv_rows=${records.length} -> output/books.csv`);
}

module.exports = { exportCSV, toCSV, toCell };