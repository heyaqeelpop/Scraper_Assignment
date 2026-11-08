# The Polite Scraper

**FlyRank Internship | Backend Track | Week 5 | Assignment A9**

A small, polite scraping pipeline for [Books to Scrape](https://books.toscrape.com/), a public practice sandbox. It downloads the first three catalogue pages, visits all 60 book pages, turns the messy HTML into clean, schema-checked JSON, survives a broken page without crashing, and ends every run with a report.

```
fetch -> extract -> normalize -> validate -> store -> report
```

## Quick start

**Lane:** JavaScript (Node.js 20+, built-in `fetch`, Cheerio, Zod)

```bash
git clone https://github.com/heyaqeelpop/scarper.git
cd scarper
npm install
npm start
```

`npm start` runs `node src/run.js`. The first run downloads about 63 pages at one request per second (roughly 1-2 minutes). Later runs read from the local cache and take under a second.

After a run you get:

| File | What it holds |
|---|---|
| `output/books.json` | 60 clean, validated, unique records |
| `output/errors.json` | records that failed validation, with reasons (normally `[]`) |
| `output/run-report.json` | counts, failures and duration of the run |

Failure test (adds one made-up URL on purpose, your side only):

```bash
npm run test-failure
```

The run still finishes, `books.json` keeps its 60 records and `run-report.json` shows `failed_pages: 1`.

## Target classification (Stage 0)

- **Site:** Books to Scrape, https://books.toscrape.com/
- **Why:** it is a sandbox built so people can practise scraping on it. That is the permission, and this is the only kind of site this project touches.
- **How much:** the first 3 catalogue pages only (60 book pages).
- **Data collected:** title, price, availability, rating, description, plus where and when each was fetched.
- **robots.txt check:** `https://books.toscrape.com/robots.txt` returned **404 Not Found**, so no robots file was found. A missing file is not permission, it is just a missing file; the sandbox statement is the permission.

I will not reuse this code on another site without checking its rules and terms first.

## Record schema

Raw fields from the page, plus one clean value:

| Field | Type | Notes |
|---|---|---|
| `title` | string | required |
| `product_url` | string (https URL) | canonical URL, used as the record identity |
| `price_text` | string | raw, e.g. `£51.77` |
| `price_gbp` | number | cleaned, e.g. `51.77` |
| `availability_text` | string | e.g. `In stock (22 available)` |
| `rating_text` | string | `One` to `Five` |
| `description` | string or null | null when the page has none |
| `source_page` | string (URL) | catalogue page where the book was found |
| `fetched_at` | ISO timestamp | when the page was fetched |

The schema is defined with Zod in `src/clean-books.js`. Every record is validated before it is stored; failures go to `errors.json` with the reason.

## Politeness rules

- **User-agent:** an honest one that names the project and links to this repo.
- **Delay:** at least 1 second between real requests. Cached pages need no delay.
- **Timeout:** every request gives up after 8 seconds.
- **Status check:** only HTTP 200 is parsed. Anything else is a failed fetch.
- **Cache:** every page is saved under `cache/` and reused, so re-runs do not hit the site.
- **Retries:** one retry after 2 seconds for timeouts, network errors and 5xx. Never for 404 or 403.
- **Scope:** only the first 3 catalogue pages and the 60 books on them.

## How the pipeline works

| Stage | File | What it does |
|---|---|---|
| Fetch + cache | `src/fetcher.js` | shared polite fetching, cache, retry, counters |
| Discover | `src/discover-pages.js` | follows the catalogue's own "next" links, builds absolute URLs, removes duplicates |
| Extract | `src/extract-books.js` | reads each book page using selectors scoped to the product area; one bad page is logged and skipped |
| Clean + validate | `src/clean-books.js` | `£51.77` becomes `51.77`, removes the site's duplicated description text, dedupes by URL, validates with Zod |
| Report | `src/run.js` | runs everything and always writes `run-report.json` |

Running twice produces the same 60 records, not 120 (idempotent): outputs are rewritten, not appended.

## Run report (real run)

<!-- PASTE YOUR REAL output/run-report.json HERE -->

```json
{
  "started_at": "...",
  "duration_seconds": 0,
  "pages_fetched": 0,
  "cache_hits": 0,
  "retries": 0,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "failures": [],
  "fatal_error": null
}
```

## Why no browser was needed

The data is already in the HTML the server sends, so a browser would only add cost.

## Limitation

The description cleanup is a heuristic: the site's HTML contains a truncated copy of the description followed by the full text, and my code removes the repeated prefix. If the site changes that markup, the cleanup could miss it. The scraper also expects exactly 60 books on 3 pages, so it fails loudly if that changes, and it is sequential (slow by design).

## Ethics note

<!-- REWRITE THIS IN YOUR OWN WORDS -->
I use an official API when one exists. I never bypass logins, paywalls or blocks. I collect only the data I need, I go slowly, and I say who I am in the user-agent. A web page is untrusted input, so everything is checked before it is stored.

## Project structure

```
scarper/
├── src/
│   ├── fetcher.js
│   ├── discover-pages.js
│   ├── extract-books.js
│   ├── clean-books.js
│   ├── run.js
│   ├── check-robots.js
│   └── index.js
├── output/            (books.json, errors.json, run-report.json, ...)
├── cache/             (ignored by git)
├── package.json
└── README.md
```