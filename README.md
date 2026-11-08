# The Polite Scraper

**FlyRank Internship | Backend Track | Week 5 | Assignment A9**

## Stage 0 – Target Classification

### 1. Target Website

**Books to Scrape**

https://books.toscrape.com/

Books to Scrape is a public practice sandbox specifically designed for developers to learn and experiment with web scraping.

### 2. Why This Website?

The website provides a safe environment to practise scraping techniques. It contains a catalogue of books with individual product pages containing structured information such as titles, prices, ratings, availability and descriptions.

### 3. Scraping Scope

This project is strictly limited to:

- The first 3 catalogue pages.
- 20 books per catalogue page.
- 60 unique book detail pages.

The scraper will follow the website's pagination links to discover the books rather than hardcoding individual URLs.

### 4. Data to Be Collected

For every book, the scraper will collect the following fields:

| Field | Description |
|---|---|
| title | Name of the book |
| product_url | Absolute URL of the book |
| price_text | Original price displayed |
| availability_text | Stock availability |
| rating_text | Book rating |
| description | Book description, if available |
| source_page | Catalogue page where the book was discovered |
| fetched_at | Date and time of fetching |

### 5. robots.txt Check

**URL:** https://books.toscrape.com/robots.txt

**HTTP Status:** 404 Not Found

**Result:** No robots.txt file found.

The website does not provide a robots.txt file at the checked URL. A missing robots.txt file is not considered automatic permission to scrape.

### 6. Ethical Considerations

- Scraping is restricted to the Books to Scrape practice sandbox.
- Only the first three catalogue pages will be processed.
- Requests will include an identifying User-Agent.
- Requests will have appropriate timeouts and delays.
- The scraper will not overload the website.
- An official API will be preferred whenever one exists.
- Logins, paywalls and website restrictions will never be bypassed.

**Important:** I will not reuse this code on another site without checking its rules and terms first.

---

### Project Progress

- [x] Stage 0 – Target classification
- [ ] Stage 1 – Fetch and cache HTML
- [ ] Stage 2 – Discover three catalogue pages
- [ ] Stage 3 – Extract book details
- [ ] Stage 4 – Validate and store records
- [ ] Stage 5 – Handle failures and generate reports
- [ ] Stage 6 – Publish to GitHub