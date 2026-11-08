const fs = require("fs/promises");
const path = require("path");
const { createHash } = require("crypto");

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const SNAPSHOT_FILE = path.join(OUTPUT_DIR, "snapshot.json");

// Hash of a record's content. fetched_at is left out on purpose: it changes
// on every download and would make every record look "changed".
function hashRecord(record) {
    const { fetched_at, ...content } = record;

    const ordered = {};
    for (const key of Object.keys(content).sort()) {
        ordered[key] = content[key];
    }

    return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}

// Compare the previous snapshot ({url: hash}) with the current records.
// A page that failed to fetch this run is "not_checked", never "gone".
function diffSnapshots(previous, records, failedUrls = []) {
    const failed = new Set(failedUrls);
    const result = {
        new: 0,
        changed: 0,
        unchanged: 0,
        gone: 0,
        not_checked: 0
    };
    const nextSnapshot = {};
    const currentUrls = new Set();

    for (const record of records) {
        const url = record.product_url;
        const hash = hashRecord(record);

        currentUrls.add(url);
        nextSnapshot[url] = hash;

        if (!(url in previous)) result.new++;
        else if (previous[url] !== hash) result.changed++;
        else result.unchanged++;
    }

    for (const url of Object.keys(previous)) {
        if (currentUrls.has(url)) continue;

        if (failed.has(url)) {
            result.not_checked++;
            nextSnapshot[url] = previous[url]; // keep what we knew
        } else {
            result.gone++;
        }
    }

    return { result, nextSnapshot };
}

async function readSnapshot() {
    try {
        return JSON.parse(await fs.readFile(SNAPSHOT_FILE, "utf-8"));
    } catch (error) {
        if (error.code === "ENOENT") return {}; // first run: everything is new
        throw error;
    }
}

async function detectChanges(records, failedUrls = []) {
    const previous = await readSnapshot();
    const { result, nextSnapshot } = diffSnapshots(
        previous,
        records,
        failedUrls
    );

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(
        SNAPSHOT_FILE,
        JSON.stringify(nextSnapshot, null, 2),
        "utf-8"
    );

    console.log(
        `changes: new=${result.new} changed=${result.changed} ` +
        `unchanged=${result.unchanged} gone=${result.gone}`
    );

    return result;
}

module.exports = { detectChanges, diffSnapshots, hashRecord };