const fs = require("fs/promises");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const DASHBOARD_FILE = path.join(OUTPUT_DIR, "dashboard.html");

// Scraped text is untrusted: escape everything before it goes into HTML
function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stat(label, value) {
    return `<div class="card"><div class="value">${esc(value)}</div>` +
           `<div class="label">${esc(label)}</div></div>`;
}

function buildHTML(records, report) {
    const prices = records.map(r => r.price_gbp);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    const avg = prices.length
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : 0;

    const newest = records
        .map(r => r.fetched_at)
        .sort()
        .pop() || "n/a";

    const order = ["One", "Two", "Three", "Four", "Five"];
    const ratingCounts = order.map(
        name => records.filter(r => r.rating_text === name).length
    );
    const maxCount = Math.max(1, ...ratingCounts);

    const bars = order.map((name, i) =>
        `<div class="bar-row"><span>${name}</span>` +
        `<div class="bar"><div style="width:${(ratingCounts[i] / maxCount) * 100}%"></div></div>` +
        `<span>${ratingCounts[i]}</span></div>`
    ).join("");

    const changes = report.changes
        ? `new ${report.changes.new} · changed ${report.changes.changed} · ` +
          `unchanged ${report.changes.unchanged} · gone ${report.changes.gone}`
        : "n/a";

    const failures = report.failures && report.failures.length
        ? `<ul>${report.failures.map(
            f => `<li>${esc(f.product_url)}<br><small>${esc(f.error)}</small></li>`
          ).join("")}</ul>`
        : "<p>No failed pages in the last run.</p>";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polite Scraper Dashboard</title>
<style>
:root { --bg:#fafafa; --fg:#1d1d1f; --card:#fff; --muted:#6b6b70; --line:#e2e2e6; --accent:#2f6fed; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#16161a; --fg:#ececf0; --card:#202026; --muted:#9a9aa3; --line:#34343c; --accent:#6c9bff; }
}
body { font-family: system-ui, sans-serif; background:var(--bg); color:var(--fg); margin:0; padding:24px; }
main { max-width: 900px; margin: 0 auto; }
h1 { margin-top:0; } h2 { margin-top:32px; font-size:1.1rem; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
.value { font-size:1.6rem; font-weight:600; } .label { color:var(--muted); font-size:.85rem; }
.bar-row { display:grid; grid-template-columns:50px 1fr 30px; gap:10px; align-items:center; margin:6px 0; }
.bar { background:var(--line); border-radius:4px; height:12px; }
.bar div { background:var(--accent); height:100%; border-radius:4px; }
small, .muted { color:var(--muted); }
</style>
</head>
<body>
<main>
<h1>Polite Scraper Dashboard</h1>
<p class="muted">Books to Scrape · last run started ${esc(report.started_at)}</p>

<div class="grid">
${stat("Valid records", records.length)}
${stat("Invalid records", report.invalid_records ?? 0)}
${stat("Failed pages", report.failed_pages ?? 0)}
${stat("Cache hits", report.cache_hits ?? 0)}
${stat("Pages fetched", report.pages_fetched ?? 0)}
${stat("Duration (s)", report.duration_seconds ?? 0)}
</div>

<h2>Price range (GBP)</h2>
<div class="grid">
${stat("Cheapest", "£" + min.toFixed(2))}
${stat("Average", "£" + avg.toFixed(2))}
${stat("Most expensive", "£" + max.toFixed(2))}
</div>

<h2>Ratings</h2>
${bars}

<h2>Freshness</h2>
<p>Most recent page download in the data: <strong>${esc(newest)}</strong></p>
<p>Changes since previous run: ${esc(changes)}</p>

<h2>Failures</h2>
${failures}
</main>
</body>
</html>
`;
}

async function buildDashboard(records, report) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(DASHBOARD_FILE, buildHTML(records, report), "utf-8");
    console.log("dashboard -> output/dashboard.html");
}

module.exports = { buildDashboard, buildHTML, esc };