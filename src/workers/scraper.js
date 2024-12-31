const {
  getActiveSearches,
  saveJobsToDatabase,
  updateSearchLastRun,
  getJobsByUser,
  getUnsentJobsPrioritized,
} = require("../database/operations");
const { sendJobsToWebhook } = require("../services/webhook");
const whatsappService = require("../services/whatsapp");
const scrapers = require("../scrapers");
const logger = require("../utils/logger");
const { normalizeJob } = require("../utils/normalizeJob");

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
        const normalizedJobs = jobs.map((job) => normalizeJob(job));

        if (normalizedJobs.length > 0) {
          // Salva as vagas no banco
          await saveJobsToDatabase(normalizedJobs, search.user_id);
          logger.info(
            `Scraped and saved ${jobs.length} jobs from ${scraperName} for user ${search.user_id}`
          );

          // Envia para o webhook
          await sendJobsToWebhook(normalizedJobs, search.id, search.user_id);
          logger.info(
            `Sent ${jobs.length} jobs to webhook from ${scraperName} for user ${search.user_id}`
          );

          // Busca as 5 melhores vagas não enviadas
          const priorityJobs = await getUnsentJobsPrioritized(
            search.user_id,
            5
          );
          if (priorityJobs.length > 0) {
            logger.info(
              `Sending ${priorityJobs.length} priority jobs via WhatsApp from ${scraperName} for user ${search.user_id}`
            );
            await whatsappService.sendJobs(
              search.user_id,
              search.whatsapp,
              priorityJobs
            );
          }
        }

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
  const searches = specificSearches || (await getActiveSearches());

  for (const search of searches) {
    let hasNewJobs = false;

    for (const [siteName, scraper] of Object.entries(scrapers)) {
      try {
        const jobs = await scraper(search.cargo, search.cidade, search.estado);
        const normalizedJobs = jobs.map((job) => normalizeJob(job));

        if (normalizedJobs.length > 0) {
          hasNewJobs = true;

          // Salva as vagas no banco
          await saveJobsToDatabase(normalizedJobs, search.user_id);
          logger.info(
            `Scraped and saved ${jobs.length} jobs from ${siteName} for user ${search.user_id}`
          );

          // Envia para o webhook
          await sendJobsToWebhook(normalizedJobs, search.id, search.user_id);
          logger.info(
            `Sent ${jobs.length} jobs to webhook from ${siteName} for user ${search.user_id}`
          );
        }
      } catch (error) {
        logger.error(
          `Error scraping ${siteName} for user ${search.user_id}:`,
          error
        );
      }
    }

    // Se encontrou novas vagas, envia as 5 melhores não enviadas por WhatsApp
    if (hasNewJobs) {
      try {
        const priorityJobs = await getUnsentJobsPrioritized(search.user_id, 5);
        if (priorityJobs.length > 0) {
          logger.info(
            `Sending ${priorityJobs.length} priority jobs via WhatsApp for user ${search.user_id}`
          );
          await whatsappService.sendJobs(
            search.user_id,
            search.whatsapp,
            priorityJobs
          );
        }
      } catch (error) {
        logger.error(
          `Error sending jobs via WhatsApp for user ${search.user_id}:`,
          error
        );
      }
    }

    // Atualiza o último run
    await updateSearchLastRun(search.id);
  }
}

// Executa a cada 3 horas
const INTERVAL = 3 * 60 * 60 * 1000;

function startWorker() {
  // Executa imediatamente na primeira vez
  runScraper();

  // Agenda as próximas execuções
  setInterval(runScraper, INTERVAL);

  logger.info("Worker do scraper iniciado");
}

module.exports = {
  runScraper,
  runSpecificScraper,
  startWorker,
};
