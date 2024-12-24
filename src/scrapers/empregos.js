const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

function removeAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function debugHtmlStructure(page) {
  const htmlStructure = await page.evaluate(() => {
    const jobListings = document.querySelectorAll("ul.list.grid-16-16 > li");
    if (jobListings.length === 0) {
      return "No job elements found with selector ul.list.grid-16-16 > li";
    }
    const firstJob = jobListings[0];
    return {
      jobTitle: firstJob.querySelector("h2 > a")?.outerHTML || "Not found",
      companyName:
        firstJob.querySelector(".nome-empresa > a")?.outerHTML || "Not found",
      jobDescription:
        firstJob.querySelector(".resumo-vaga")?.outerHTML || "Not found",
      fullHTML: firstJob.outerHTML,
    };
  });
}

async function empregosScraper(jobTitle, city, state) {
  logger.info("Starting Empregos.com.br scraper...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  logger.info("Browser launched");

  const page = await browser.newPage();
  logger.info("New page created");

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  const encodedJobTitle = encodeURIComponent(removeAcentos(jobTitle));
  const encodedCity = encodeURIComponent(removeAcentos(city.toLowerCase()));
  const encodedState = encodeURIComponent(removeAcentos(state.toLowerCase()));
  const searchUrl = `https://www.empregos.com.br/vagas/${encodedCity}/${encodedState}/${encodedJobTitle}`;

  try {
    logger.info(`Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    logger.info("Page loaded");

    await page.waitForSelector("ul.list.grid-16-16 > li", { timeout: 10000 });

    await debugHtmlStructure(page);

    await autoScroll(page);

    logger.info("Starting job extraction");
    const jobs = await page.evaluate(
      (searchCity, searchState) => {
        const jobElements = document.querySelectorAll(
          "ul.list.grid-16-16 > li"
        );

        return Array.from(jobElements).map((job) => {
          const titleElement = job.querySelector("h2 > a");
          const companyElement = job.querySelector(".nome-empresa > a");
          const descriptionElement = job.querySelector(".resumo-vaga");
          const locationElement = job.querySelector(".nome-empresa");

          const cargo = titleElement ? titleElement.textContent.trim() : "N/A";
          const empresa = companyElement
            ? companyElement.textContent.trim()
            : "N/A";
          const descricao = descriptionElement
            ? descriptionElement.textContent.trim()
            : "N/A";
          const url = titleElement ? titleElement.href : "N/A";

          const locationText = locationElement
            ? locationElement.textContent.trim()
            : "";
          const locationMatch = locationText.match(/- (.+) - (.+)$/);
          const extractedCity = locationMatch
            ? locationMatch[1].trim()
            : searchCity;
          const extractedState = locationMatch
            ? locationMatch[2].trim()
            : searchState;

          return {
            cargo,
            empresa,
            cidade: extractedCity,
            estado: extractedState,
            descricao,
            url,
            origem: "Empregos.com.br",
            tipo: "N/A",
            isHomeOffice: descricao.toLowerCase().includes("home office"),
            isConfidential: empresa.toLowerCase().includes("confidencial"),
          };
        });
      },
      city,
      state
    );

    logger.info(`Extracted ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping Empregos.com.br:", error);
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

module.exports = empregosScraper;
