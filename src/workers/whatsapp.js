const logger = require("../utils/logger");
const { getUnsentJobs, getActiveSearches } = require("../database/operations");
const whatsappService = require("../services/whatsapp");

async function sendPendingJobs() {
  try {
    // Verifica se está dentro do horário de trabalho
    if (!whatsappService.isWithinWorkingHours()) {
      logger.info(
        "Fora do horário de trabalho (9h-20h). Pulando envio de vagas."
      );
      return;
    }

    // Busca todas as buscas ativas
    const searches = await getActiveSearches();

    for (const search of searches) {
      try {
        // Busca vagas não enviadas para este usuário
        const jobs = await getUnsentJobs(search.user_id);

        if (jobs.length > 0) {
          logger.info(
            `Enviando ${jobs.length} vagas para o usuário ${search.user_id}`
          );
          await whatsappService.sendJobs(search.user_id, search.whatsapp, jobs);
        }
      } catch (error) {
        logger.error(`Erro ao processar busca ${search.id}:`, error);
      }
    }
  } catch (error) {
    logger.error("Erro ao executar sendPendingJobs:", error);
  }
}

// Executa a cada 3 horas
const INTERVAL = 3 * 60 * 60 * 1000;

function startWorker() {
  // Executa imediatamente na primeira vez
  sendPendingJobs();

  // Agenda as próximas execuções
  setInterval(sendPendingJobs, INTERVAL);

  logger.info("Worker do WhatsApp iniciado");
}

module.exports = {
  startWorker,
  sendPendingJobs,
};
