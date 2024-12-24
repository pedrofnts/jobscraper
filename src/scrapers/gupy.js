const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

async function cathoScraper(jobTitle, city, state) {
  logger.info("Starting Catho scraper...");
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

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    const encodedJobTitle = encodeURIComponent(
      jobTitle.toLowerCase().replace(/ /g, "-")
    );
    const encodedCity = encodeURIComponent(
      city.toLowerCase().replace(/ /g, "-")
    );
    const encodedState = encodeURIComponent(state.toLowerCase());
    const url = `https://www.catho.com.br/vagas/${encodedJobTitle}/${encodedCity}-${encodedState}/`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector(".search-result-custom_jobItem__OGz3a", {
      timeout: 30000,
    });

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(
        ".search-result-custom_jobItem__OGz3a"
      );
      return Array.from(jobElements).map((job) => {
        const titleElement = job.querySelector(
          ".Title-module__title___3S2cv a"
        );
        const companyElement = job.querySelector(".sc-sLsrZ");
        const salaryElement = job.querySelector(
          ".custom-styled_salaryText__oSvPo"
        );
        const locationElement = job.querySelector(".sc-lbJcrp a");
        const dateElement = job.querySelector(
          ".custom-styled_cardJobTime__ZvAIb span"
        );
        const descriptionElement = job.querySelector(".job-description");

        const title = titleElement ? titleElement.textContent.trim() : "N/A";
        const company = companyElement
          ? companyElement.textContent.trim()
          : "N/A";
        const salary = salaryElement ? salaryElement.textContent.trim() : "N/A";
        const location = locationElement
          ? locationElement.textContent.trim()
          : "N/A";
        const date = dateElement ? dateElement.textContent.trim() : "N/A";
        const description = descriptionElement
          ? descriptionElement.textContent.trim()
          : "N/A";
        const url = titleElement ? titleElement.href : "N/A";

        const [city, dirtyState] = location.split(" - ");
        const state = dirtyState
          ? dirtyState.replace(/\s*\([^)]*\)/, "")
          : "N/A";

        return {
          cargo: title,
          empresa: company,
          cidade: city,
          estado: state,
          descricao: description,
          url: url,
          origem: "Catho",
          tipo: "N/A",
          isHomeOffice:
            description.toLowerCase().includes("home office") ||
            description.toLowerCase().includes("remoto"),
          isConfidential: company.toLowerCase().includes("confidencial"),
          dataPublicacao: date,
          salario: salary,
        };
      });
    });

    logger.info(`Found ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping Catho:", error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = cathoScraper;
