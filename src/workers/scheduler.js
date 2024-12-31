const cron = require("node-cron");
const {
  getActiveSearches,
  updateSearchStatus,
} = require("../database/operations");
const { runScraper } = require("./scraper");
const logger = require("../utils/logger");

const CRON_SCHEDULE = process.env.SCRAPER_CRON || "0 0 * * *";
const BATCH_SIZE = 5; // ou via env: process.env.SCRAPER_BATCH_SIZE

// Executa todos os dias às 00:00
const scheduleDailyJobs = () => {
  cron.schedule(
    CRON_SCHEDULE,
    async () => {
      try {
        const searches = await getActiveSearches();

        // Processa em lotes
        for (let i = 0; i < searches.length; i += BATCH_SIZE) {
          const batch = searches.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (search) => {
              try {
                await updateSearchStatus(search.id, "scraping");
                await runScraper([search]);
                await updateSearchStatus(search.id, "completed");
              } catch (error) {
                await updateSearchStatus(search.id, "error");
                logger.error(
                  `Erro no scraping para busca ${search.id}:`,
                  error
                );
              }
            })
          );
        }
      } catch (error) {
        logger.error("Erro ao executar scraping diário:", error);
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  logger.info("Scheduler de scraping diário configurado");
};

module.exports = { scheduleDailyJobs };
