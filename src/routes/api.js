// src/routes/api.js
const express = require("express");
const router = express.Router();
const {
  createSearch,
  getJobsByUser,
  markJobsAsSent,
} = require("../database/operations");
const { runScraper } = require("../workers/scraper");
const validateRequest = require("../middleware/validate");
const { searchSchema } = require("../validation/schemas");
const { searchesCreated } = require("../monitoring/metrics");

// Configurar busca para um usuário
router.post("/searches", validateRequest(searchSchema), async (req, res) => {
  try {
    const { user_id, cargo, cidade, estado } = req.body;
    
    // Cria a busca no banco
    const search = await createSearch({ user_id, cargo, cidade, estado });
    
    // Executa o scraping imediatamente para esta busca específica
    await runScraper([search]); // Modificamos para aceitar uma busca específica
    
    // Incrementa métrica
    searchesCreated.inc();
    
    res.json({
      ...search,
      message: "Busca criada e executada com sucesso"
    });
  } catch (error) {
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

// Marcar vagas como enviadas
router.post("/jobs/mark-sent", async (req, res) => {
  try {
    const { jobIds } = req.body;
    await markJobsAsSent(jobIds);
    res.json({ success: true });
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

module.exports = router;
