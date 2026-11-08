const fs = require("fs/promises");
const path = require("path");

const USER_AGENT =
    "FlyRankInternship-A9/1.0 (+https://github.com/heyaqeelpop/scarper)";
const TIMEOUT_MS = 8000;      // give up on a request after 8 seconds
const MIN_DELAY_MS = 1000;    // pause between REAL requests (cache hits skip this)
const RETRY_WAIT_MS = 2000;   // pause before the single retry

// Counters used by the run report
const stats = { pagesFetched: 0, cacheHits: 0, retries: 0 };

let lastRequestAt = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class FetchError extends Error {
    constructor(message, { status = null, retryable = false } = {}) {
        super(message);
        this.status = status;
        this.retryable = retryable;
    }
}

// Make sure at least MIN_DELAY_MS passes between real requests
async function politeWait() {
    const wait = lastRequestAt + MIN_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
}

async function fetchOnce(url) {
    await politeWait();

    let response;
    try {
        response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
    } catch (error) {
        // timeout or network failure -> worth one more try
        throw new FetchError(
            `Network error or timeout for ${url}: ${error.message}`,
            { retryable: true }
        );
    }

    if (response.status !== 200) {
        // 5xx = server trouble, retry. 404 / 403 / other 4xx = never retry.
        throw new FetchError(`HTTP ${response.status} for ${url}`, {
            status: response.status,
            retryable: response.status >= 500
        });
    }

    return response.text();
}

async function fetchWithRetry(url) {
    try {
        return await fetchOnce(url);
    } catch (error) {
        if (!error.retryable) throw error;

        stats.retries++;
        console.log(`RETRY (once): ${error.message}`);
        await sleep(RETRY_WAIT_MS);

        return fetchOnce(url);
    }
}

// Return cached HTML if we have it, otherwise fetch politely and cache it
async function getHTML(url, cacheFile, label) {
    try {
        const cached = await fs.readFile(cacheFile, "utf-8");
        stats.cacheHits++;
        console.log(`CACHE HIT: ${label}`);
        return cached;
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    console.log(`FETCH: ${label}`);
    const html = await fetchWithRetry(url);

    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, html, "utf-8");

    stats.pagesFetched++;
    return html;
}

module.exports = { getHTML, stats, FetchError };