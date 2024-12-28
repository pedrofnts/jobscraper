const indeedScraper = require("./indeed");
const tramposScraper = require("./trampos");
const empregosScraper = require("./empregos");
const vagasScraper = require("./vagas");
const infojobsScraper = require("./infojobs");
const nineNineJobsScraper = require("./99jobs");
const gupyScraper = require("./gupy");
const cathoScraper = require("./catho");
const linkedinScraper = require("./linkedin");
const glassdoorScraper = require("./glassdoor");


const scrapers = {
  indeed: indeedScraper,
  trampos: tramposScraper,
  empregos: empregosScraper,
  vagas: vagasScraper,
  infojobs: infojobsScraper,
  "99jobs": nineNineJobsScraper,
  gupy: gupyScraper,
  catho: cathoScraper,
  linkedin: linkedinScraper,
  glassdoor: glassdoorScraper
};

module.exports = scrapers;