const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");
const axios = require("axios");

async function getGeonameId(city, state) {
  try {
    const response = await axios.get(`http://api.geonames.org/searchJSON`, {
      params: {
        q: `${city}, ${state}`,
        maxRows: 1,
        username: "pedrofontes",
      },
    });

    if (response.data.geonames && response.data.geonames.length > 0) {
      return response.data.geonames[0].geonameId;
    }
    return null;
  } catch (error) {
    logger.error("Error fetching geoname ID:", error);
    return null;
  }
}

async function waitForSelector(page, selector, timeout = 30000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    logger.warn(`Timeout waiting for selector: ${selector}`);
    return false;
  }
}

async function bebeeScraper(jobTitle, city, state) {
  logger.info("Starting Bebee.com.br scraper...");
  const browser = await createBrowser();

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  const geonameId = await getGeonameId(city, state);
  const encodedJobTitle = encodeURIComponent(jobTitle);
  const encodedLocation = encodeURIComponent(`${city}, ${city}`);
  const searchUrl = `https://br.bebee.com/jobs?term=${encodedJobTitle}&location=${encodedLocation}&geoname_id=${geonameId}&search=1`;

  try {
    logger.info(`Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

    const selectorFound = await waitForSelector(
      page,
      ".nf-job.list-group-item"
    );
    if (!selectorFound) {
      logger.warn(
        "Job listings not found. The search might have returned no results."
      );
      return [];
    }

    await autoScroll(page);

    const jobs = await page.evaluate(
      (searchCity, searchState) => {
        const jobElements =
          document.querySelectorAll(".nf-job.list-group-item") ||
          document.querySelectorAll(".list-group-item") ||
          document.querySelectorAll("[class*='job']");

        return Array.from(jobElements).map((job) => {
          const titleElement =
            job.querySelector("h2 a") || job.querySelector("a");
          const companyElement =
            job.querySelector(".nf-job-list-info span:first-child") ||
            job.querySelector("[class*='company']");
          const descriptionElement =
            job.querySelector("p.mt-2.mb-0") || job.querySelector("p");

          const cargo = titleElement ? titleElement.textContent.trim() : "N/A";
          const empresa = companyElement
            ? companyElement.textContent.replace(/^.*business\s*/, "").trim()
            : "N/A";
          const descricao = descriptionElement
            ? descriptionElement.textContent.trim()
            : "N/A";
          const url =
            titleElement && titleElement.href ? titleElement.href : "N/A";

          return {
            cargo,
            empresa,
            cidade: searchCity,
            estado: searchState,
            descricao,
            url,
            origem: "Bebee.com.br",
            tipo: "N/A",
            isHomeOffice:
              descricao.toLowerCase().includes("home office") ||
              descricao.toLowerCase().includes("remoto"),
            isConfidential: empresa.toLowerCase().includes("confidencial"),
          };
        });
      },
      city,
      state
    );

    logger.info(`Found ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping Bebee.com.br:", error);
    return [];
  } finally {
    await browser.close();
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

module.exports = bebeeScraper;
