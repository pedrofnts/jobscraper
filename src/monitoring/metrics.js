const prometheus = require("prom-client");

prometheus.collectDefaultMetrics();

const scrapeCounter = new prometheus.Counter({
  name: "jobs_scraped_total",
  help: "Total de vagas encontradas",
  labelNames: ["source"],
});

const scrapeErrors = new prometheus.Counter({
  name: "scrape_errors_total",
  help: "Total de erros no scraping",
  labelNames: ["source"],
});

const searchesCreated = new prometheus.Counter({
  name: "searches_created_total",
  help: "Total de buscas criadas",
});

const dailyScrapingSuccess = new prometheus.Counter({
  name: "daily_scraping_success_total",
  help: "Total de scraping diários bem sucedidos",
});

const dailyScrapingError = new prometheus.Counter({
  name: "daily_scraping_error_total",
  help: "Total de erros em scraping diários",
});

const webhookCounter = new prometheus.Counter({
  name: "webhook_calls_total",
  help: "Total de chamadas ao webhook",
  labelNames: ["status"],
});

module.exports = {
  scrapeCounter,
  scrapeErrors,
  searchesCreated,
  dailyScrapingSuccess,
  dailyScrapingError,
  webhookCounter,
};
