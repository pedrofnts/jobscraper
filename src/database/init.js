const pool = require("./config");
const logger = require("../utils/logger");

const createTables = async () => {
  const client = await pool.connect();
  try {
    // Criar tabela de usuários (se necessário para futuras implementações)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Criar tabela de buscas
    await client.query(`
      CREATE TABLE IF NOT EXISTS searches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        cargo VARCHAR(255) NOT NULL,
        cidade VARCHAR(255) NOT NULL,
        estado VARCHAR(2) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        last_run TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Criar tabela de vagas
    await client.query(`
      CREATE TABLE IF NOT EXISTS vagas (
        id SERIAL PRIMARY KEY,
        cargo VARCHAR(255) NOT NULL,
        empresa VARCHAR(255),
        cidade VARCHAR(255),
        estado VARCHAR(2),
        descricao TEXT,
        url VARCHAR(1000),
        origem VARCHAR(50),
        tipo VARCHAR(100),
        is_home_office BOOLEAN DEFAULT false,
        is_confidential BOOLEAN DEFAULT false,
        data_publicacao DATE,
        salario_minimo DECIMAL(10,2),
        salario_maximo DECIMAL(10,2),
        nivel VARCHAR(50),
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT vagas_url_user_id_key UNIQUE (url, user_id)
      );
    `);

    // Criar índices para melhor performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vagas_user_id ON vagas(user_id);
      CREATE INDEX IF NOT EXISTS idx_vagas_status ON vagas(status);
      CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);
      CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
    `);

    logger.info('Tabelas criadas com sucesso!');
  } catch (error) {
    logger.error('Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Função para executar o script
const initDatabase = async () => {
  try {
    await createTables();
    logger.info('Inicialização do banco de dados concluída');
    process.exit(0);
  } catch (error) {
    logger.error('Falha na inicialização do banco de dados:', error);
    process.exit(1);
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  initDatabase();
}

module.exports = { createTables, initDatabase }; 