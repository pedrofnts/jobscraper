const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

async function nineNineJobsScraper(jobTitle, city, state) {
  logger.info("Starting 99jobs scraper...");
  const browser = await puppeteer.launch({
    headless: "true",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a user agent to mimic a real browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Construct the URL
    const encodedJobTitle = encodeURIComponent(jobTitle);
    const encodedCity = encodeURIComponent(city);
    const stateCode = getStateCode(state);
    const url = `https://99jobs.com/opportunities/filtered_search/search_opportunities?page=1&search[term]=${encodedJobTitle}&search%5Bstate%5D=${stateCode}&search%5Bcity%5D%5B%5D=${encodedCity}`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for job listings to load
    await page.waitForSelector(".opportunity-card", { timeout: 30000 });

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(".opportunity-card");
      return Array.from(jobElements).map((job) => {
        const titleElement = job.querySelector("h1");
        const companyElement = job.querySelector(
          ".opportunity-company-infos h2"
        );
        const locationElement = job.querySelector(".opportunity-address p");
        const levelElement = job.querySelector(".opportunity-label-level");
        const modeElement = job.querySelector(".opportunity-label-acting-mode");
        const urlElement = job;

        const title = titleElement ? titleElement.textContent.trim() : "N/A";
        const company = companyElement
          ? companyElement.textContent.trim()
          : "N/A";
        const location = locationElement
          ? locationElement.textContent.trim()
          : "N/A";
        const level = levelElement ? levelElement.textContent.trim() : "N/A";
        const mode = modeElement ? modeElement.textContent.trim() : "N/A";
        const url = urlElement ? urlElement.href : "N/A";

        // Extract city and state from location
        const [jobCity, jobState] = location
          .split(",")
          .map((item) => item.trim());

        return {
          cargo: title,
          empresa: company,
          cidade: jobCity || "N/A",
          estado: jobState || "N/A",
          nivel: level,
          tipo: mode,
          url: url,
          origem: "99jobs",
          isHomeOffice: mode.toLowerCase().includes("remoto"),
          isConfidential: company.toLowerCase().includes("confidencial"),
          dataPublicacao: "N/A", // This information is not readily available in the provided HTML
        };
      });
    });

    logger.info(`Found ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping 99jobs:", error);
    return [];
  } finally {
    await browser.close();
  }
}

function getStateCode(state) {
  const states = [
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ];
  const index = states.indexOf(state.toUpperCase());
  return index !== -1 ? index + 2 : 0;
}

module.exports = nineNineJobsScraper;
