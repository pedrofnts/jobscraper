const {
  getActiveSearches,
  saveJobsToDatabase,
  updateSearchLastRun,
} = require("../database/operations");
const scrapers = require("../scrapers");
const logger = require("../utils/logger");

async function runSpecificScraper(scraperName) {
  try {
    const searches = await getActiveSearches();
    const scraper = scrapers[scraperName];

    if (!scraper) {
      throw new Error(`Scraper ${scraperName} não encontrado`);
    }

    for (const search of searches) {
      try {
        const jobs = await scraper(search.cargo, search.cidade, search.estado);
        await saveJobsToDatabase(jobs, search.user_id);
        logger.info(
          `Scraped ${jobs.length} jobs from ${scraperName} for user ${search.user_id}`
        );
        await updateSearchLastRun(search.id);
      } catch (error) {
        logger.error(
          `Error scraping ${scraperName} for user ${search.user_id}:`,
          error
        );
      }
    }
  } catch (error) {
    logger.error(`Error in runSpecificScraper: ${error.message}`);
    throw error;
  }
}
async function runScraper(specificSearches = null) {
  // Se specificSearches for fornecido, usa ele. Caso contrário, busca todas as buscas ativas
  const searches = specificSearches || await getActiveSearches();

  for (const search of searches) {
    for (const [siteName, scraper] of Object.entries(scrapers)) {
      try {
        const jobs = await scraper(search.cargo, search.cidade, search.estado);
        await saveJobsToDatabase(jobs, search.user_id);
        logger.info(
          `Scraped ${jobs.length} jobs from ${siteName} for user ${search.user_id}`
        );
      } catch (error) {
        logger.error(
          `Error scraping ${siteName} for user ${search.user_id}:`,
          error
        );
      }
    }
    await updateSearchLastRun(search.id);
  }
}

module.exports = { runScraper,
  runSpecificScraper 
 };
