const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

async function vagasComBrScraper(jobTitle, city, state) {
  logger.info("Starting Vagas.com.br scraper...");
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
    const encodedState = encodeURIComponent(state);
    const url = `https://www.vagas.com.br/vagas-de-${encodedJobTitle}-${encodedCity}-${encodedState}?ordenar_por=mais_recentes`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Check for and close modal if present
    try {
      await page.waitForSelector("#interactive-close-button", {
        timeout: 5000,
      });
      await page.click("#interactive-close-button");
      logger.info("Modal closed successfully");
    } catch (error) {
      logger.info(
        "No modal found or unable to close. Continuing with scraping."
      );
    }

    // Wait for job listings to load
    await page.waitForSelector("li.vaga", { timeout: 30000 });

    const jobs = await page.evaluate(
      ({ searchCity, searchState }) => {
        const jobElements = document.querySelectorAll("li.vaga");
        return Array.from(jobElements).map((job) => {
          const titleElement = job.querySelector("h2.cargo a");
          const companyElement = job.querySelector("span.emprVaga");
          const descriptionElement = job.querySelector("div.detalhes p");
          const locationElement = job.querySelector("span.vaga-local");
          const dateElement = job.querySelector("span.data-publicacao");

          const title = titleElement ? titleElement.textContent.trim() : "N/A";
          const company = companyElement
            ? companyElement.textContent.trim()
            : "N/A";
          const description = descriptionElement
            ? descriptionElement.textContent.trim()
            : "N/A";
          const location = locationElement
            ? locationElement.textContent.trim()
            : "";
          const date = dateElement ? dateElement.textContent.trim() : "N/A";

          // Extract city and state from location
          let [jobCity, jobState] = ["N/A", "N/A"];
          if (location) {
            const locationParts = location
              .split("/")
              .map((item) => item.trim());
            jobCity = locationParts[0] || searchCity;
            jobState = locationParts[1] || searchState;
          }

          return {
            cargo: title,
            empresa: company,
            cidade: jobCity,
            estado: jobState,
            descricao: description,
            url: titleElement ? titleElement.href : "N/A",
            origem: "Vagas.com.br",
            tipo: "N/A", // This information is not readily available in the provided HTML
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
    logger.error("Error scraping Vagas.com.br:", error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = vagasComBrScraper;
