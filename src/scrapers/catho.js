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

/**
 * Função para converter texto de salário em valores numéricos de mínimo e máximo.
 * Exs:
 *  - "De R$ 6.001,00 a R$ 7.000,00" => min=6001.00, max=7000.00
 *  - "Até R$ 2.500,00" => min=null, max=2500.00
 *  - "Acima de R$ 10.000,00" => min=10000.00, max=null
 *  - "A combinar" => min=null, max=null
 */
function parseSalary(salaryText) {
  if (!salaryText) return [null, null];

  // Remove pontos e troca vírgula por ponto
  // "De R$ 6.001,00 a R$ 7.000,00" => "De R$ 6001.00 a R$ 7000.00"
  const cleanText = salaryText
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
    .toLowerCase();

  // A combinar
  if (cleanText.includes('a combinar')) {
    return [null, null];
  }

  // De R$ X a R$ Y
  const rangeRegex = /de r\$ (\d+(\.\d+)?) a r\$ (\d+(\.\d+)?)/i;
  const matchRange = cleanText.match(rangeRegex);
  if (matchRange) {
    const min = parseFloat(matchRange[1]);
    const max = parseFloat(matchRange[3]);
    return [min, max];
  }

  // Até R$ X
  const ateRegex = /até r\$ (\d+(\.\d+)?)/i;
  const matchAte = cleanText.match(ateRegex);
  if (matchAte) {
    const max = parseFloat(matchAte[1]);
    return [null, max];
  }

  // Acima de R$ X
  const acimaRegex = /acima de r\$ (\d+(\.\d+)?)/i;
  const matchAcima = cleanText.match(acimaRegex);
  if (matchAcima) {
    const min = parseFloat(matchAcima[1]);
    return [min, null];
  }

  // Caso nenhum padrão seja identificado
  return [null, null];
}

/**
 * Função para converter texto de data no formato “Publicada em 24/12”,
 * “Publicada hoje” e “Publicada ontem” em ISO (YYYY-MM-DD).
 */
function parseDate(dateText) {
  if (!dateText) return null;
  const lowerText = dateText.toLowerCase().trim();

  const today = new Date();
  const currYear = today.getFullYear();

  const dateRegex = /(atualizada em|publicada em)\s+(\d{1,2})\/(\d{1,2})/i;
  const match = lowerText.match(dateRegex);
  
  if (match) {
    const day = parseInt(match[2], 10);
    const month = parseInt(match[3], 10) - 1; // JS months are 0-based
    
    // Validate day and month
    if (month >= 0 && month < 12 && day > 0 && day <= 31) {
      const date = new Date(currYear, month, day);
      // Check if date is in future, if so subtract a year
      if (date > today) {
        date.setFullYear(currYear - 1);
      }
      return date.toISOString().split('T')[0];
    }
  }

  if (lowerText.includes('hoje')) return today.toISOString().split('T')[0];
  if (lowerText.includes('ontem')) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  return null;
}

async function cathoScraper(jobTitle, city, state) {
  logger.info("Starting Catho scraper...");
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();

    // Intercepta requests para bloquear imagens, styles e fontes
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

    // Monta a URL com "order=dataAtualizacao" para pegar pela data
    const encodedJobTitle = encodeURIComponent(
      jobTitle.toLowerCase().replace(/ /g, "-")
    );
    const encodedCity = encodeURIComponent(
      city.toLowerCase().replace(/ /g, "-")
    );
    const encodedState = encodeURIComponent(state.toLowerCase());

    // Exemplo: https://www.catho.com.br/vagas/desenvolvedor/sao-paulo-sp/?order=dataAtualizacao
    const url = `https://www.catho.com.br/vagas/${encodedJobTitle}/${encodedCity}-${encodedState}/?order=dataAtualizacao`;

    logger.info(`Navigating to ${url}`);

    await retryOperation(async () => {
      await page.goto(url, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 120000,
      });
      await checkForCaptcha(page);
    });

    // Espera pelos itens de vaga
    await page.waitForSelector(".search-result-custom_jobItem__OGz3a", {
      timeout: 30000,
    });

    // Avalia o DOM e extrai as informações
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll(
        ".search-result-custom_jobItem__OGz3a"
      );

      return Array.from(jobElements).map((job) => {
        const titleElement = job.querySelector(".Title-module__title___3S2cv a");
        const companyElement = job.querySelector(".sc-sLsrZ");
        const salaryElement = job.querySelector(".custom-styled_salaryText__oSvPo");
        const locationElement = job.querySelector(".sc-lbJcrp a");
        const dateElement = job.querySelector(".custom-styled_cardJobTime__ZvAIb span");
        const descriptionElement = job.querySelector(".job-description");

        const title = titleElement ? titleElement.textContent.trim() : "N/A";
        const company = companyElement ? companyElement.textContent.trim() : "N/A";
        const salaryText = salaryElement ? salaryElement.textContent.trim() : "N/A";
        const locationText = locationElement ? locationElement.textContent.trim() : "N/A";
        const dateText = dateElement ? dateElement.textContent.trim() : "N/A";
        const description = descriptionElement ? descriptionElement.textContent.trim() : "N/A";
        const url = titleElement ? titleElement.href : "N/A";

        // Tenta separar cidade e estado do texto "São Paulo - SP"
        let [city, state] = ["N/A", "N/A"];
if (locationText.includes(" - ")) {
  // Extract just the city and state, removing any trailing numbers/parentheses
  const locationParts = locationText.split(" - ").map(part => part.trim());
  city = locationParts[0];
  // Get state abbreviation (SP) from "SP (1)" format
  state = locationParts[1].split(" ")[0];
} else {
          // fallback se não tiver o padrão com " - "
          city = locationText;
          state = "";
        }

        return {
          cargo: title,
          empresa: company,
          cidade: city,
          estado: state,
          descricao: description,
          url,
          origem: "Catho",
          tipo: null, // pode ajustar se houver campo de tipo
          isHomeOffice:
            description.toLowerCase().includes("home office") ||
            description.toLowerCase().includes("remoto"),
          isConfidential: company.toLowerCase().includes("confidencial"),
          // Vamos apenas retornar raw text e tratar fora do evaluate
          salaryRaw: salaryText,
          dateRaw: dateText,
        };
      });
    });

    // Trata salário e data FORA do evaluate (no Node) usando as funções auxiliares
    const processedJobs = jobs.map((job) => {
      // Parse do salário
      const [salarioMinimo, salarioMaximo] = parseSalary(job.salaryRaw);

      // Parse da data
      const data_publicacao = parseDate(job.dateRaw);

      return {
        cargo: job.cargo,
        empresa: job.empresa,
        cidade: job.cidade,
        estado: job.estado,
        descricao: job.descricao,
        url: job.url,
        origem: job.origem,
        tipo: job.tipo,
        is_home_office: job.isHomeOffice,
        is_confidential: job.isConfidential,
        data_publicacao,
        salario_minimo: salarioMinimo,
        salario_maximo: salarioMaximo,
        nivel: null, // Ajustar se quiser extrair nível
      };
    });

    logger.info(`Found ${processedJobs.length} jobs`);
    return processedJobs;
  } catch (error) {
    logger.error("Error scraping Catho:", error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = cathoScraper;
