const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");

async function tramposScraper(jobTitle, city, state) {
  logger.info("Starting Trampos.co scraper...");
  const browser = await createBrowser();
  logger.info("Browser launched");

  const page = await browser.newPage();
  logger.info("New page created");

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  });

  const encodedJobTitle = encodeURIComponent(jobTitle);
  const encodedCity = encodeURIComponent(city);
  const searchUrl = `https://trampos.co/oportunidades/?lc=${encodedCity}&tr=${encodedJobTitle}`;

  try {
    logger.info(`Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    logger.info("Page loaded");

    await page.waitForSelector(".opportunity-box", { timeout: 10000 });

    await autoScroll(page);

    logger.info("Starting job extraction");
    const jobLinks = await page.evaluate(() => {
      const links = document.querySelectorAll(".opportunity-box a.ember-view");
      return Array.from(links)
        .map((link) => {
          const href = link.getAttribute("href");
          return href.startsWith("/oportunidades/")
            ? `https://trampos.co${href}`
            : null;
        })
        .filter(Boolean);
    });

    logger.info(`Found ${jobLinks.length} job links`);

    const jobs = [];
    for (const link of jobLinks) {
      const jobDetails = await scrapeJobDetails(browser, link, city, state);
      if (jobDetails) {
        jobs.push(jobDetails);
      }
    }

    logger.info(`Extracted ${jobs.length} jobs`);

    return jobs;
  } catch (error) {
    logger.error("Error scraping Trampos.co:", error);
    throw error;
  } finally {
    await browser.close();
    logger.info("Browser closed");
  }
}

async function scrapeJobDetails(browser, url, searchCity, searchState) {
  const page = await browser.newPage();
  logger.info(`Navigating to job page: ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  logger.info(`Job page loaded: ${url}`);

  const jobDetails = await page.evaluate(
    ({ searchCity, searchState }) => {
      const getTextContent = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : "N/A";
      };

      const titleElement =
        document.querySelector("h1.name") || document.querySelector("h1");
      const companyElement = document.querySelector(".company-name");
      const addressElement = document.querySelector("p.address");
      const descriptionElement =
        document.querySelector(".opportunity-description") ||
        document.querySelector(".description");
      const typeElement =
        document.querySelector(".opportunity-type") ||
        document.querySelector(".type");

      let cargo = getTextContent("h1.name") || getTextContent("h1");
      cargo = cargo.replace("#SP", "").trim();

      let isConfidential = document.body.innerText
        .toLowerCase()
        .includes("confidencial");

      let empresa = isConfidential
        ? "Confidencial"
        : getTextContent(".company-name") || "N/A";
      if (empresa === "N/A" && !isConfidential) {
        empresa = addressElement
          ? addressElement.textContent.split("|")[0].trim()
          : "N/A";
      }

      let cidade = searchCity;
      let estado = searchState;
      let isHomeOffice = false;

      if (addressElement) {
        const addressText = addressElement.textContent.trim().toLowerCase();
        if (
          addressText.includes("home office") ||
          addressText.includes("remoto")
        ) {
          isHomeOffice = true;
          cidade = "Home office";
          estado = "N/A";
        }
      }

      let descricao = "N/A";
      if (descriptionElement) {
        descricao = descriptionElement.innerText.trim();
      } else {
        const possibleDescElements = document.querySelectorAll(
          '[class*="description"]'
        );
        for (const elem of possibleDescElements) {
          if (elem.innerText.trim().length > 0) {
            descricao = elem.innerText.trim();
            break;
          }
        }
      }

      return {
        cargo: cargo,
        empresa: empresa,
        cidade: cidade,
        estado: estado,
        descricao: descricao,
        url: window.location.href,
        origem: "Trampos.co",
        tipo: getTextContent(".opportunity-type") || getTextContent(".type"),
        isHomeOffice: isHomeOffice,
        isConfidential: isConfidential,
      };
    },
    { searchCity, searchState }
  );

  await page.close();
  return jobDetails;
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

module.exports = tramposScraper;
