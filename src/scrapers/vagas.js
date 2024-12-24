const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

async function vagasComBrScraper(jobTitle, city, state) {
  logger.info("Starting Vagas.com.br scraper...");
  const browser = await puppeteer.launch({
    headless: true,
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

    const encodedJobTitle = encodeURIComponent(jobTitle);
    const encodedCity = encodeURIComponent(city);
    const encodedState = encodeURIComponent(state);
    const url = `https://www.vagas.com.br/vagas-de-${encodedJobTitle}-${encodedCity}-${encodedState}?ordenar_por=mais_recentes`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector("li.vaga", { timeout: 30000 });

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll("li.vaga");
      return Array.from(jobElements).map((job) => {
        const titleElement = job.querySelector("h2.cargo a");
        const companyElement = job.querySelector("span.emprVaga");
        const descriptionElement = job.querySelector("div.detalhes p");
        const locationElement = job.querySelector("span.vaga-local");
        const dateElement = job.querySelector("span.data-publicacao");
        const levelElement = job.querySelector("span.nivelVaga");

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
        const level = levelElement ? levelElement.textContent.trim() : "N/A";

        let datapublicacao = "N/A";
        if (dateElement) {
          const rawDate = dateElement.textContent.trim();
          if (rawDate.includes("Há")) {
            const daysAgo = parseInt(rawDate.match(/\d+/), 10);
            const currentDate = new Date();
            currentDate.setDate(currentDate.getDate() - daysAgo);
            datapublicacao = currentDate.toISOString().split("T")[0];
          } else if (rawDate === "Hoje") {
            const currentDate = new Date();
            datapublicacao = currentDate.toISOString().split("T")[0];
          } else if (rawDate === "Ontem") {
            const currentDate = new Date();
            currentDate.setDate(currentDate.getDate() - 1);
            datapublicacao = currentDate.toISOString().split("T")[0];
          } else if (/\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
            const [day, month, year] = rawDate.split("/");
            datapublicacao = `${year}-${month}-${day}`;
          }
        }

        return {
          cargo: title,
          empresa: company,
          cidade: location.split("/")[0]?.trim() || "N/A",
          estado: location.split("/")[1]?.trim() || "N/A",
          descricao: description,
          url: titleElement ? titleElement.href : "N/A",
          origem: "Vagas.com.br",
          datapublicacao: datapublicacao !== "N/A" ? datapublicacao : null,
          nivel: level !== "N/A" ? level : null,
        };
      });
    });

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
