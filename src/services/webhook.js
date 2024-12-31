const axios = require("axios");
const logger = require("../utils/logger");
const { webhookCounter } = require("../monitoring/metrics");
const { validateJob } = require("../validation/jobSchema");

async function sendJobsToWebhook(jobs, searchId, userId) {
  try {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn("WEBHOOK_URL não configurada, pulando envio");
      return;
    }

    logger.info(
      `Enviando ${jobs.length} vagas para webhook (Busca ${searchId}, Usuário ${userId})`
    );

    const validatedJobs = jobs.map((job) => validateJob(job));

    const payload = {
      search_id: searchId,
      user_id: userId,
      jobs: validatedJobs,
      timestamp: new Date().toISOString(),
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.WEBHOOK_API_KEY,
      },
      timeout: 5000,
    });

    webhookCounter.labels("success").inc();
    logger.info(
      `Vagas enviadas com sucesso para webhook. Status: ${response.status}`
    );
    return response.data;
  } catch (error) {
    webhookCounter.labels("error").inc();
    logger.error(`Erro ao enviar vagas para webhook: ${error.message}`);
    throw error;
  }
}

module.exports = { sendJobsToWebhook };
