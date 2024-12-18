const axios = require("axios");
const logger = require("../utils/logger");

async function empregoLigadoScraper(jobTitle, city, state) {
  logger.info("Starting EmpregoLigado scraper...");

  const encodedJobTitle = encodeURIComponent(jobTitle);
  const url = `https://www.empregoligado.com.br/api-proxy/britney/jobs?features_mode=external&page=1&limit=29&country=BR&keyword=${encodedJobTitle}`;

  try {
    logger.info(`Making request to ${url}`);
    const response = await axios.get(url);

    if (!response.data || !response.data.jobs) {
      logger.warn("No jobs data found in the API response");
      return [];
    }

    const jobs = response.data.jobs
      .filter(
        (job) =>
          job.address &&
          job.address.city &&
          job.address.city.toLowerCase() === city.toLowerCase() &&
          job.address.state &&
          job.address.state.toLowerCase() === state.toLowerCase()
      )
      .map((job) => ({
        cargo: job.title,
        empresa: job.company ? job.company.name : "N/A",
        cidade: job.address.city,
        estado: job.address.state,
        descricao: job.description,
        url: `https://www.empregoligado.com.br/pt-br/vagas/detalhe/${job.id}`,
        origem: "EmpregoLigado",
        tipo: job.contract || "N/A",
        isHomeOffice: job.home_office || false,
        isConfidential: job.confidential || false,
        salario: job.salary_detail ? job.salary_detail.value : 0,
        beneficios: job.benefits
          ? Object.keys(job.benefits)
              .filter((key) => job.benefits[key])
              .join(", ")
          : "N/A",
      }));

    logger.info(`Found ${jobs.length} jobs matching ${city}, ${state}`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping EmpregoLigado:", error);
    return [];
  }
}

module.exports = empregoLigadoScraper;
