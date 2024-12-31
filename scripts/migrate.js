require("dotenv").config();
const { initDatabase } = require("../src/database/init");
const logger = require("../src/utils/logger");

async function migrate() {
  try {
    logger.info("Iniciando migração do banco de dados...");
    await initDatabase();
    logger.info("Migração concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    logger.error("Erro durante a migração:", error);
    process.exit(1);
  }
}

migrate();
