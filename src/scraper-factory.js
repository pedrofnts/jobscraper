const indeedScraper = require("./scrapers/indeed");
const tramposScraper = require("./scrapers/trampos");
const empregosScraper = require("./scrapers/empregos");
const vagasScraper = require("./scrapers/vagas");
const infojobsScraper = require("./scrapers/infojobs");
const nineNineJobsScraper = require("./scrapers/99jobs");
const gupyScraper = require("./scrapers/gupy");
const cathoScraper = require("./scrapers/catho");
const config = require('config');
const puppeteer = require('puppeteer');

const scrapers = {
  indeed: indeedScraper,
  trampos: tramposScraper,
  empregos: empregosScraper,
  vagas: vagasScraper,
  infojobs: infojobsScraper,
  "99jobs": nineNineJobsScraper,
  gupy: gupyScraper,
  catho: cathoScraper,
};

const puppeteerConfig = config.get('puppeteer');

async function createBrowser() {
  return await puppeteer.launch({
    ...puppeteerConfig,
    headless: true,
    args: [
      ...puppeteerConfig.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions'
    ]
  });
}

function getScraper(site) {
  const scraper = scrapers[site.toLowerCase()];
  if (!scraper) {
    throw new Error(`Scraper not found for site: ${site}`);
  }
  return scraper;
}

module.exports = { getScraper, scrapers, createBrowser };
