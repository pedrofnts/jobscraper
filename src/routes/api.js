// src/routes/api.js
const express = require("express");
const router = express.Router();
const {
  createSearch,
  getJobsByUser,
  updateSearchStatus,
  getUnsentJobsPrioritized,
  findExistingSearch,
  updateExistingSearch,
} = require("../database/operations");
const { runScraper, runSpecificScraper } = require("../workers/scraper");
const validateRequest = require("../middleware/validate");
const { searchSchema } = require("../validation/schemas");
const { searchesCreated } = require("../monitoring/metrics");
const logger = require("../utils/logger");
const whatsappService = require("../services/whatsapp");

// Configurar busca para um usuário
router.post("/searches", validateRequest(searchSchema), async (req, res) => {
  try {
    logger.info("Iniciando criação/atualização de busca");
    const { cargo, cidade, estado, whatsapp } = req.body;
    const user_id = parseInt(req.body.user_id, 10);

    // Verifica se já existe uma busca para este usuário
    const existingSearch = await findExistingSearch(user_id);

    let search;
    let shouldRunScraper = true;

    if (existingSearch) {
      // Verifica se houve mudança nos parâmetros da busca
      const hasChanges =
        existingSearch.cargo !== cargo ||
        existingSearch.cidade !== cidade ||
        existingSearch.estado !== estado;

      if (hasChanges) {
        logger.info(
          `Atualizando busca existente ${existingSearch.id} para usuário ${user_id}`
        );
        search = await updateExistingSearch(existingSearch.id, {
          cargo,
          cidade,
          estado,
          whatsapp,
        });

        // Envia confirmação por WhatsApp apenas se houve mudança
        try {
          await whatsappService.sendSearchConfirmation(user_id, whatsapp, {
            cargo,
            cidade,
            estado,
          });
          logger.info("Confirmação enviada por WhatsApp");
        } catch (error) {
          logger.error("Erro ao enviar confirmação por WhatsApp:", error);
        }
      } else {
        logger.info(
          `Nenhuma mudança nos parâmetros da busca ${existingSearch.id}`
        );
        search = existingSearch;
        shouldRunScraper = false;
      }
    } else {
      logger.info(`Criando nova busca para usuário ${user_id}`);
      search = await createSearch({
        user_id,
        cargo,
        cidade,
        estado,
        whatsapp,
      });

      // Envia mensagem de boas-vindas para nova busca
      try {
        await whatsappService.sendSearchConfirmation(user_id, whatsapp, {
          cargo,
          cidade,
          estado,
          isFirstSearch: true,
        });
        logger.info("Mensagem de boas-vindas enviada por WhatsApp");
      } catch (error) {
        logger.error(
          "Erro ao enviar mensagem de boas-vindas por WhatsApp:",
          error
        );
      }
    }

    logger.info("Busca criada/atualizada com sucesso");

    // Executa o scraping em background apenas se necessário
    if (shouldRunScraper) {
      setImmediate(async () => {
        try {
          await updateSearchStatus(search.id, "scraping");
          logger.info(
            `Iniciando scraping em background para busca ${search.id}`
          );

          await runScraper([search]);

          // Busca as 5 melhores vagas não enviadas
          const priorityJobs = await getUnsentJobsPrioritized(user_id, 5);
          if (priorityJobs.length > 0) {
            logger.info(
              `Enviando ${priorityJobs.length} vagas prioritárias por WhatsApp para o usuário ${user_id}`
            );
            await whatsappService.sendJobs(user_id, whatsapp, priorityJobs);
          }

          await updateSearchStatus(search.id, "active");
          logger.info(
            `Scraping em background finalizado para busca ${search.id}. Status alterado para active.`
          );
          searchesCreated.inc();
        } catch (error) {
          await updateSearchStatus(search.id, "error");
          logger.error(
            `Erro no scraping em background para busca ${search.id}:`,
            error
          );
        }
      });
    }

    // Retorna resposta imediatamente
    res.json({
      ...search,
      message: shouldRunScraper
        ? existingSearch
          ? "Busca atualizada com sucesso. O scraping será executado em background."
          : "Busca criada com sucesso. O scraping será executado em background."
        : "Nenhuma mudança nos parâmetros da busca.",
    });
    logger.info("Resposta enviada com sucesso");
  } catch (error) {
    logger.error("Erro na rota /searches:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obter vagas de um usuário
router.get("/jobs/:userId", async (req, res) => {
  try {
    const jobs = await getJobsByUser(req.params.userId);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manter a rota manual de scraping para testes
router.post("/scrape", async (req, res) => {
  try {
    await runScraper();
    res.json({ message: "Scraping completed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para executar um scraper específico
router.post("/scrape/:scraper", async (req, res) => {
  try {
    const { scraper } = req.params;
    const supportedScrapers = [
      "vagas",
      "indeed",
      "infojobs",
      "trampos",
      "gupy",
      "catho",
      "linkedin",
      "glassdoor",
    ];

    if (!supportedScrapers.includes(scraper.toLowerCase())) {
      return res.status(400).json({
        error: `Scraper inválido. Scrapers suportados: ${supportedScrapers.join(
          ", "
        )}`,
      });
    }

    await runSpecificScraper(scraper);
    res.json({ message: `Scraping completed for ${scraper}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota de health check
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Consultar status da busca
router.get("/searches/:searchId/status", async (req, res) => {
  try {
    const { searchId } = req.params;
    const query = `SELECT status FROM searches WHERE id = $1`;
    const result = await pool.query(query, [searchId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Busca não encontrada" });
    }

    res.json({ status: result.rows[0].status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
