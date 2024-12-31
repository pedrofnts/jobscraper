const { pool } = require("./connection");
const logger = require("../utils/logger");

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Tabela de buscas
    await client.query(`
      CREATE TABLE IF NOT EXISTS searches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        cargo VARCHAR(100) NOT NULL,
        cidade VARCHAR(100) NOT NULL,
        estado CHAR(2) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_run TIMESTAMP
      )
    `);

    // Tabela de vagas
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        cargo VARCHAR(200) NOT NULL,
        empresa VARCHAR(200),
        cidade VARCHAR(100),
        estado CHAR(2),
        descricao TEXT,
        url TEXT NOT NULL UNIQUE,
        origem VARCHAR(50) NOT NULL,
        tipo VARCHAR(50),
        is_home_office BOOLEAN DEFAULT FALSE,
        is_confidential BOOLEAN DEFAULT FALSE,
        data_publicacao DATE,
        salario_minimo DECIMAL(10,2),
        salario_maximo DECIMAL(10,2),
        nivel VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de relação usuário-vaga
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_jobs (
        user_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, job_id),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      )
    `);

    // Índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_data_publicacao ON jobs(data_publicacao);
      CREATE INDEX IF NOT EXISTS idx_user_jobs_user_id ON user_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_jobs_sent_at ON user_jobs(sent_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_url ON jobs(url);
    `);

    await client.query("COMMIT");
    logger.info("Database initialized successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  initDatabase,
};

if (require.main === module) {
  (async () => {
    try {
      logger.info("Iniciando criação do banco de dados...");
      await initDatabase();
      logger.info("Banco de dados inicializado com sucesso");
      process.exit(0);
    } catch (error) {
      logger.error("Erro ao inicializar banco de dados:", error);
      process.exit(1);
    }
  })();
}
