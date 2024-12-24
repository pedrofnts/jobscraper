const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");
const axios = require("axios");

async function getLocationId(city, state) {
  try {
    const query = encodeURIComponent(`${city} ${state}`);
    const url = `https://www.infojobs.com.br/mf-publicarea/api/autocompleteapi/locations?query=${query}`;
    const response = await axios.get(url);

    if (
      response.data &&
      response.data.suggestions &&
      response.data.suggestions.length > 0
    ) {
      return response.data.suggestions[0].data.id;
    }
    return null;
  } catch (error) {
    logger.error("Error fetching location ID:", error);
    return null;
  }
}

async function infoJobsScraper(jobTitle, city, state) {
  logger.info("Starting InfoJobs scraper...");
  const browser = await createBrowser();
  
  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.setViewport({ width: 1366, height: 768 });

    const encodedJobTitle = encodeURIComponent(jobTitle);
    const locationId = await getLocationId(city, state);
    if (!locationId) {
      logger.error("Failed to get location ID");
      return [];
    }
    const url = `https://www.infojobs.com.br/empregos.aspx?palabra=${encodedJobTitle}&poblacion=${locationId}`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    await page.waitForSelector(
      ".card.card-shadow.card-shadow-hover.text-break.mb-16.grid-row",
      { timeout: 30000 }
    );

    const jobs = await page.evaluate(
      ({ searchCity, searchState }) => {
        const jobElements = document.querySelectorAll(
          ".card.card-shadow.card-shadow-hover.text-break.mb-16.grid-row"
        );
        return Array.from(jobElements).map((job) => {
          const titleElement = job.querySelector("h2.h3.font-weight-bold");
          const companyElement = job.querySelector(".text-body a");
          const descriptionElement = job.querySelector(
            ".small.text-medium:last-child"
          );
          const dateElement = job.querySelector(".text-medium.small");
          const urlElement = job.querySelector("a.text-decoration-none");

          const title = titleElement ? titleElement.textContent.trim() : "N/A";
          const company = companyElement
            ? companyElement.textContent.trim()
            : "N/A";
          const description = descriptionElement
            ? descriptionElement.textContent.trim()
            : "N/A";
          const date = dateElement ? dateElement.textContent.trim() : "N/A";
          const url = urlElement
            ? "https://www.infojobs.com.br" + urlElement.getAttribute("href")
            : "N/A";

          return {
            cargo: title,
            empresa: company,
            cidade: searchCity,
            estado: searchState,
            descricao: description,
            url: url,
            origem: "InfoJobs",
            tipo: "N/A",
            isHomeOffice:
              description.toLowerCase().includes("home office") ||
              description.toLowerCase().includes("remoto"),
            isConfidential: company.toLowerCase().includes("confidencial"),
            dataPublicacao: date,
          };
        });
      },
      { searchCity: city, searchState: state }
    );

    logger.info(`Found ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping InfoJobs:", error);
    return [];
  }
}

module.exports = infoJobsScraper;
