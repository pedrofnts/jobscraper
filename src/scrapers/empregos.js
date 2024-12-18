const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

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
  console.log("HTML Structure Debug:");
  console.log(JSON.stringify(htmlStructure, null, 2));
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

  // Set a user agent to mimic a real browser
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  // Construct the search URL
  const encodedJobTitle = encodeURIComponent(jobTitle);
  const encodedCity = encodeURIComponent(city.toLowerCase());
  const encodedState = encodeURIComponent(state.toLowerCase());
  const searchUrl = `https://www.empregos.com.br/vagas/${encodedCity}/${encodedState}/${encodedJobTitle}`;

  try {
    logger.info(`Navigating to ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    logger.info("Page loaded");

    // Wait for job listings to load
    await page.waitForSelector("ul.list.grid-16-16 > li", { timeout: 10000 });

    // Debug HTML structure
    await debugHtmlStructure(page);

    // Scroll to ensure all content is loaded
    await autoScroll(page);

    logger.info("Starting job extraction");
    const jobs = await page.evaluate(
      (searchCity, searchState) => {
        const jobElements = document.querySelectorAll(
          "ul.list.grid-16-16 > li"
        );

        console.log(`DEBUG: Found ${jobElements.length} job elements`);

        return Array.from(jobElements).map((job, index) => {
          const titleElement = job.querySelector("h2 > a");
          const companyElement = job.querySelector(".nome-empresa > a");
          const descriptionElement = job.querySelector(".resumo-vaga");
          const locationElement = job.querySelector(".nome-empresa");

          console.log(`DEBUG: Job ${index + 1}`);
          console.log(`DEBUG: Title element found: ${titleElement !== null}`);
          console.log(
            `DEBUG: Title text: ${
              titleElement ? titleElement.textContent : "N/A"
            }`
          );
          console.log(
            `DEBUG: Company element found: ${companyElement !== null}`
          );
          console.log(
            `DEBUG: Company text: ${
              companyElement ? companyElement.textContent : "N/A"
            }`
          );

          const cargo = titleElement ? titleElement.textContent.trim() : "N/A";
          const empresa = companyElement
            ? companyElement.textContent.trim()
            : "N/A";
          const descricao = descriptionElement
            ? descriptionElement.textContent.trim()
            : "N/A";
          const url = titleElement ? titleElement.href : "N/A";

          // Extract location from the full location text
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

          console.log(`DEBUG: Extracted cargo: ${cargo}`);
          console.log(`DEBUG: Extracted empresa: ${empresa}`);
          console.log(`DEBUG: Extracted URL: ${url}`);
          console.log(`DEBUG: Extracted city: ${extractedCity}`);
          console.log(`DEBUG: Extracted state: ${extractedState}`);

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

    // Log detailed information about each extracted job
    jobs.forEach((job, index) => {
      console.log(`\n--- Job ${index + 1} ---`);
      console.log(`Cargo: ${job.cargo}`);
      console.log(`Empresa: ${job.empresa}`);
      console.log(`Cidade: ${job.cidade}`);
      console.log(`Estado: ${job.estado}`);
      console.log(`Descrição: ${job.descricao.substring(0, 100)}...`);
      console.log(`URL: ${job.url}`);
      console.log(`Origem: ${job.origem}`);
      console.log(`Tipo: ${job.tipo}`);
      console.log(`Home Office: ${job.isHomeOffice}`);
      console.log(`Confidencial: ${job.isConfidential}`);
    });

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
