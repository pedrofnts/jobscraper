const pool = require("../database/config");
const logger = require("../utils/logger");
const cron = require("node-cron");

async function cleanOldJobs() {
  const client = await pool.connect();
  try {
    const query = `
            DELETE FROM vagas 
            WHERE created_at < NOW() - INTERVAL '30 days'
            RETURNING id
        `;
    const result = await client.query(query);
    logger.info(`Cleaned ${result.rowCount} old jobs`);
    return result.rowCount;
  } catch (error) {
    logger.error("Error cleaning old jobs:", error);
    throw error;
  } finally {
    client.release();
  }
}

function scheduleCleanup() {
  cron.schedule("0 0 * * *", async () => {
    try {
      const deletedCount = await cleanOldJobs();
      logger.info(`Scheduled cleanup completed. Deleted ${deletedCount} jobs`);
    } catch (error) {
      logger.error("Scheduled cleanup failed:", error);
    }
  });
}

module.exports = {
  cleanOldJobs,
  scheduleCleanup,
};
