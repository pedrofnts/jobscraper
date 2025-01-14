const { createBrowser } = require("../scraper-factory");
const logger = require("../utils/logger");

async function vagasComBrScraper(jobTitle, city, state) {
  logger.info("Starting Vagas.com.br scraper...");
  const browser = await createBrowser();

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

    const jobs = await page.evaluate(
      ({ searchCity, searchState }) => {
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
          const level = levelElement ? levelElement.textContent.trim() : "N/A";

          // ---------------------------------------
          // 1) Ajuste para separar cidade/estado
          // ---------------------------------------
          let jobCity = searchCity;
          let jobState = searchState;

          if (locationElement) {
            const locationText = locationElement.textContent.trim();
            // Tenta capturar padrão "Cidade / SP"
            // ou "100% Home Office" etc.
            // Ajuste conforme o formato que aparece no site.
            const pattern = /^(.*?)\s*\/\s*(\w{2})$/;
            // Ex.: "São Paulo / SP" casa com:
            // grupo 1 => São Paulo
            // grupo 2 => SP

            const match = locationText.match(pattern);
            if (match) {
              jobCity = match[1].trim();
              jobState = match[2].trim();
            } else {
              // Se não casar, pode gravar tudo como cidade
              // ou simplesmente deixar default (searchCity, searchState)
              jobCity = locationText;
              jobState = searchState;
            }
          }

          // ---------------------------------------
          // 2) Ajuste para capturar a data de publicação
          // ---------------------------------------
          let data_publicacao = null;
          if (dateElement) {
            const rawDate = dateElement.textContent.trim();

            // Testa se está no formato DD/MM/AAAA
            const regexData = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
            if (regexData.test(rawDate)) {
              const [_, dia, mes, ano] = rawDate.match(regexData);
              // Mes no JS é 0-based, então subtraímos 1
              const parsedDate = new Date(ano, Number(mes) - 1, Number(dia));
              data_publicacao = parsedDate.toISOString().split("T")[0];
            } else if (rawDate.includes("Há")) {
              // Formato "Há X dias"
              const daysAgo = parseInt(rawDate.match(/\d+/), 10);
              const currentDate = new Date();
              currentDate.setDate(currentDate.getDate() - daysAgo);
              data_publicacao = currentDate.toISOString().split("T")[0];
            } else if (rawDate === "Hoje") {
              data_publicacao = new Date().toISOString().split("T")[0];
            } else if (rawDate === "Ontem") {
              const currentDate = new Date();
              currentDate.setDate(currentDate.getDate() - 1);
              data_publicacao = currentDate.toISOString().split("T")[0];
            }
          }

          // ----- URL -----
          let jobUrl = null;
          if (titleElement && titleElement.href) {
            jobUrl = titleElement.href;
          }

          return {
            cargo: title,
            empresa: company,
            cidade: jobCity,
            estado: jobState,
            descricao: description,
            url: jobUrl,
            origem: "Vagas.com.br",
            tipo: null,
            is_home_office: description.toLowerCase().includes("home office"),
            is_confidential: company.toLowerCase().includes("confidencial"),
            data_publicacao: data_publicacao,
            salario_minimo: null,
            salario_maximo: null,
            nivel: level,
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
