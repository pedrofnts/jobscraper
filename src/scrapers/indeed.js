const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

async function scrapeIndeed(jobTitle, city, state) {
  logger.info("Starting Indeed scraper...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  logger.info("Browser launched");

  const page = await browser.newPage();
  logger.info("New page created");

  // Set a user agent to mimic a real browser
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  // Set extra HTTP headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });

  const baseUrl = "https://br.indeed.com/jobs";
  const encodedJobTitle = encodeURIComponent(jobTitle);
  const encodedLocation = encodeURIComponent(`${city}, ${state}`);
  const url = `${baseUrl}?q=${encodedJobTitle}&l=${encodedLocation}`;

  try {
    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    logger.info("Page loaded");

    // Wait for job listings to load
    await page.waitForSelector(".job_seen_beacon", { timeout: 10000 });

    // Scroll to ensure all content is loaded
    await autoScroll(page);

    logger.info("Starting job extraction");
    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".job_seen_beacon")).map(
        (job) => {
          const cargoElement = job.querySelector(".jobTitle span");
          const empresaElement = job.querySelector(
            '[data-testid="company-name"]'
          );
          const descricaoElement = job.querySelector(".job-snippet");
          const urlElement = job.querySelector("h2.jobTitle a");

          return {
            cargo: cargoElement ? cargoElement.textContent.trim() : "N/A",
            empresa: empresaElement ? empresaElement.textContent.trim() : "N/A",
            descricao: descricaoElement
              ? descricaoElement.textContent.trim()
              : "N/A",
            url: urlElement
              ? "https://br.indeed.com" + urlElement.getAttribute("href")
              : "N/A",
          };
        }
      );
    });
    logger.info(`Extracted ${jobs.length} jobs`);

    return jobs.map((job) => ({
      ...job,
      cidade: city,
      estado: state,
      origem: "indeed.com",
    }));
  } catch (error) {
    logger.error("Error scraping Indeed:", error);
    throw error;
  } finally {
    await browser.close();
    logger.info("Browser closed");
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

module.exports = scrapeIndeed;
