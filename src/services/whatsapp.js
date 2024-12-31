const axios = require("axios");
const logger = require("../utils/logger");
const { markJobsAsSent } = require("../database/operations");

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
  }

  async sendMessage(remoteJid, text) {
    try {
      const payload = {
        number: remoteJid,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: false,
        },
        textMessage: {
          text: text,
        },
      };

      const response = await axios.post(
        `${this.apiUrl}/message/sendText/EmpregoZAP`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        }
      );

      logger.info(`Mensagem enviada com sucesso para ${remoteJid}`);
      return response.data;
    } catch (error) {
      logger.error(`Erro ao enviar mensagem para ${remoteJid}:`, error);
      throw error;
    }
  }

  async sendSearchConfirmation(userId, remoteJid, searchDetails) {
    const message =
      `🔍 *Nova busca configurada!*\n\n` +
      `Estou buscando vagas com os seguintes critérios:\n` +
      `📋 Cargo: ${searchDetails.cargo}\n` +
      `📍 Cidade: ${searchDetails.cidade}\n` +
      `🏠 Estado: ${searchDetails.estado}\n\n` +
      `Enviarei as vagas encontradas a cada 3 horas, entre 9h e 20h. Fique atento! 😊`;

    return this.sendMessage(remoteJid, message);
  }

  async sendJobs(userId, remoteJid, jobs) {
    if (!jobs.length) return;

    // Divide as vagas em grupos de 5
    const jobGroups = [];
    for (let i = 0; i < jobs.length; i += 5) {
      jobGroups.push(jobs.slice(i, i + 5));
    }

    for (const group of jobGroups) {
      const message = this._formatJobsMessage(group);
      await this.sendMessage(remoteJid, message);

      // Marca as vagas como enviadas
      const jobIds = group.map((job) => job.id);
      await markJobsAsSent(jobIds, userId);

      // Aguarda 2 segundos entre cada grupo para evitar flood
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  _formatJobsMessage(jobs) {
    let message = `🎯 *Novas vagas encontradas!*\n\n`;

    jobs.forEach((job, index) => {
      message += `*${index + 1}. ${job.cargo}*\n`;
      message += `🏢 Empresa: ${
        job.is_confidential ? "Confidencial" : job.empresa
      }\n`;
      message += `📍 Local: ${job.cidade}/${job.estado}${
        job.is_home_office ? " (Home Office)" : ""
      }\n`;

      if (job.salario_minimo && job.salario_maximo) {
        message += `💰 Salário: R$ ${job.salario_minimo.toLocaleString(
          "pt-BR"
        )}`;
        if (job.salario_minimo !== job.salario_maximo) {
          message += ` a R$ ${job.salario_maximo.toLocaleString("pt-BR")}`;
        }
        message += "\n";
      }

      if (job.tipo) {
        message += `📋 Tipo: ${job.tipo}\n`;
      }

      if (job.nivel) {
        message += `📊 Nível: ${job.nivel}\n`;
      }

      message += `🔗 Link: ${job.url}\n\n`;
    });

    return message;
  }

  isWithinWorkingHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 9 && hour < 20;
  }
}

module.exports = new WhatsAppService();
