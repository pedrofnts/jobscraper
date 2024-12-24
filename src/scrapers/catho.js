const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");

async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      logger.warn(`Tentativa ${i + 1} falhou, tentando novamente...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function checkForCaptcha(page) {
  const captcha = await page.$('[id*="captcha"]');
  if (captcha) {
    logger.warn("Captcha detectado!");
    throw new Error("Captcha encontrado");
  }
}

async function cathoScraper(jobTitle, city, state) {
  logger.info("Starting Catho scraper...");
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (["image", "stylesheet", "font"].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

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

    await retryOperation(async () => {
      await page.goto(url, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 120000,
      });
      await checkForCaptcha(page);
    });

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

        const [city, state] = location.split(" - ");

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
