const logger = require("../utils/logger");
const { pool } = require("../database/connection");

async function cleanupOldJobs() {
  const client = await pool.connect();
  try {
    // Remove vagas mais antigas que 30 dias
    const result = await client.query(`
      DELETE FROM jobs
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    logger.info(`Removidas ${result.rowCount} vagas antigas`);
  } catch (error) {
    logger.error("Erro ao limpar vagas antigas:", error);
  } finally {
    client.release();
  }
}

// Executa a cada 24 horas
const INTERVAL = 24 * 60 * 60 * 1000;

function startWorker() {
  // Executa imediatamente na primeira vez
  cleanupOldJobs();

  // Agenda as próximas execuções
  setInterval(cleanupOldJobs, INTERVAL);

  logger.info("Worker de limpeza iniciado");
}

module.exports = {
  cleanupOldJobs,
  startWorker,
};
