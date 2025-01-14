// infojobs-scraper.js
const { createBrowser } = require("../scraper-factory");
const logger = require("../utils/logger");
const axios = require("axios");

/**
 * Retorna o ID de localização (cidade, estado) usado pelo InfoJobs
 * Ex: "São Paulo SP" => 7398
 */
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

/**
 * Realiza o scraping de vagas no InfoJobs, retornando um array de objetos
 * com as informações de cada vaga.
 */
async function infoJobsScraper(jobTitle, city, state) {
  logger.info("Starting InfoJobs scraper...");
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();

    // Ajustar o userAgent para evitar bloqueios
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.setViewport({ width: 1366, height: 768 });

    // Obter o ID da localização para inserir na URL
    const locationId = await getLocationId(city, state);
    if (!locationId) {
      logger.error("Failed to get location ID");
      return [];
    }

    // Construir a URL de busca no InfoJobs
    const encodedJobTitle = encodeURIComponent(jobTitle);
    const url = `https://www.infojobs.com.br/empregos.aspx?palabra=${encodedJobTitle}&poblacion=${locationId}&campo=griddate&orden=desc`;

    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    // Aguardar o carregamento de pelo menos um card de vaga
    await page.waitForSelector(
      ".card.card-shadow.card-shadow-hover.text-break.mb-16.grid-row",
      { timeout: 30000 }
    );

    // Extrair as vagas
    const jobs = await page.evaluate(
      ({ searchCity, searchState }) => {
        const jobElements = document.querySelectorAll(".js_vacancyLoad");

        return Array.from(jobElements).map((job) => {
          // ----- CARGO -----
          const titleElement = job.querySelector("h2.h3.font-weight-bold");
          const cargo = titleElement ? titleElement.textContent.trim() : null;

          // ----- EMPRESA & CONFIDENCIAL -----
          let companyName = null;
          let isConfidential = false;

          const companyLink = job.querySelector(".text-body a");
          if (companyLink) {
            // Se existir link, pegamos o texto do <a>
            companyName = companyLink.textContent.trim();
          } else {
            // Se não existir link, buscamos o texto do .text-body
            const textBodyElement = job.querySelector(".text-body");
            if (textBodyElement) {
              const textBodyText = textBodyElement.textContent
                .trim()
                .toLowerCase();

              // Se contém a palavra "confidencial"
              if (textBodyText.includes("confidencial")) {
                isConfidential = true;
                // companyName = null (mantém nulo)
              } else {
                // Comparar com o cargo (também em lowercase)
                if (textBodyText === cargo?.toLowerCase()) {
                  // Então está repetido, não é nome de empresa
                  companyName = null;
                } else {
                  // Caso contrário, consideramos este texto como empresa
                  // Mas lembre de pegar a versão original sem lowercase
                  companyName = textBodyElement.textContent.trim();
                }
              }
            }
          }

          // ----- DESCRIÇÃO (pegar a última .small.text-medium) -----
          const descriptionNodes = job.querySelectorAll(".small.text-medium");
          let descriptionElement = null;
          if (descriptionNodes.length > 0) {
            descriptionElement = descriptionNodes[descriptionNodes.length - 1];
          }
          const descricao = descriptionElement
            ? descriptionElement.textContent.trim()
            : null;

          // ----- DATA DA PUBLICAÇÃO (pega do data-value no .js_date) -----
          const dateElement = job.querySelector(".js_date");
          let dataPublicacao = null;
          if (dateElement) {
            const dateValue = dateElement.getAttribute("data-value");
            if (dateValue) {
              // Normalmente vem "YYYY/MM/DD HH:MM:SS"
              dataPublicacao = dateValue.split(" ")[0].replace(/\//g, "-");
              // Fica "YYYY-MM-DD"
            }
          }

          // ----- SALÁRIO -----
          const salaryElement = job.querySelector(".mr-16");
          let salarioMinimo = null;
          let salarioMaximo = null;
          if (salaryElement) {
            const salaryText = salaryElement.textContent.trim();
            const salaryMatch = salaryText.match(
              /R\$\s*([\d,.]+)(?:\s*a\s*R\$\s*([\d,.]+))?/
            );
            if (salaryMatch) {
              salarioMinimo = parseFloat(
                salaryMatch[1].replace(/\./g, "").replace(",", ".")
              );
              salarioMaximo = salaryMatch[2]
                ? parseFloat(
                    salaryMatch[2].replace(/\./g, "").replace(",", ".")
                  )
                : salarioMinimo;
            }
          }

          // ----- TIPO DE TRABALHO -----
          // Normalmente está em ".mr-16 + .mr-16"
          const jobTypeElement = job.querySelector(".mr-16 + .mr-16");
          const tipo = jobTypeElement
            ? jobTypeElement.textContent.trim()
            : null;

          // ----- NÍVEL -----
          // Normalmente em ".mr-16 + .mr-16 + .mr-16"
          const levelElement = job.querySelector(".mr-16 + .mr-16 + .mr-16");
          const nivel = levelElement ? levelElement.textContent.trim() : null;

          // ----- HOME OFFICE -----
          // Normalmente .text-medium.caption indica "Presencial" ou "Home Office"
          // Se não estiver lá, verificar na descrição as palavras "home office" ou "remoto"
          const homeOfficeElement = job.querySelector(".text-medium.caption");
          const isHomeOffice = homeOfficeElement
            ? homeOfficeElement.textContent
                .toLowerCase()
                .includes("home office")
            : descricao
            ? descricao.toLowerCase().includes("home office") ||
              descricao.toLowerCase().includes("remoto")
            : false;

          // ----- URL -----
          // Pegar link (href) do primeiro elemento com "a.text-decoration-none"
          let url = null;
          const urlElement = job.querySelector("a.text-decoration-none");
          if (urlElement) {
            url =
              "https://www.infojobs.com.br" + urlElement.getAttribute("href");
          }

          return {
            cargo: cargo,
            empresa: companyName,
            cidade: searchCity,
            estado: searchState,
            descricao: descricao,
            url: url,
            origem: "InfoJobs",
            tipo: tipo,
            is_home_office: isHomeOffice,
            is_confidential: isConfidential,
            data_publicacao: dataPublicacao,
            salario_minimo: salarioMinimo,
            salario_maximo: salarioMaximo,
            nivel: nivel,
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
  } finally {
    // Fechar o browser mesmo em caso de sucesso ou erro
    await browser.close();
  }
}

module.exports = infoJobsScraper;
