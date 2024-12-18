const indeedScraper = require("./scrapers/indeed");
const tramposScraper = require("./scrapers/trampos");
const empregosScraper = require("./scrapers/empregos");
const bebeeScraper = require("./scrapers/bebee");
const empregoligadoScraper = require("./scrapers/empregoligado");
const vagasScraper = require("./scrapers/vagas");
const infojobsScraper = require("./scrapers/infojobs");
const nineNineJobsScraper = require("./scrapers/99jobs");
const gupyScraper = require("./scrapers/gupy");
const cathoScraper = require("./scrapers/catho");

const scrapers = {
  indeed: indeedScraper,
  trampos: tramposScraper,
  empregos: empregosScraper,
  bebee: bebeeScraper,
  empregoligado: empregoligadoScraper,
  vagas: vagasScraper,
  infojobs: infojobsScraper,
  "99jobs": nineNineJobsScraper,
  gupy: gupyScraper,
  catho: cathoScraper,
};

function getScraper(site) {
  const scraper = scrapers[site.toLowerCase()];
  if (!scraper) {
    throw new Error(`Scraper not found for site: ${site}`);
  }
  return scraper;
}

module.exports = { getScraper, scrapers };
