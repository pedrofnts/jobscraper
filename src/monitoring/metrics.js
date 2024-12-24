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

module.exports = {
  scrapeCounter,
  scrapeErrors,
  searchesCreated,
};
