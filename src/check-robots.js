const url = "https://books.toscrape.com/robots.txt";

async function checkRobots() {
    try {
        console.log("Checking robots.txt...");

        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
        });

        console.log("URL:", url);
        console.log("Status:", response.status);

        if (response.status === 200) {
            const content = await response.text();

            console.log("robots.txt exists.");
            console.log("Content:\n", content);
        } else if (response.status === 404) {
            console.log("No robots.txt file found.");
        } else {
            console.log("Unexpected response:", response.status);
        }

    } catch (error) {
        console.error("Request failed:", error.message);
    }
}

checkRobots();