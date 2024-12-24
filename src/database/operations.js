const pool = require("./config");

async function createSearch(search) {
  const { user_id, cargo, cidade, estado } = search;
  const query = `
    INSERT INTO searches (user_id, cargo, cidade, estado)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await pool.query(query, [user_id, cargo, cidade, estado]);
  return result.rows[0];
}

async function getActiveSearches() {
  const query = `SELECT * FROM searches WHERE status = 'active'`;
  const result = await pool.query(query);
  return result.rows;
}

async function updateSearchLastRun(searchId) {
  const query = `
    UPDATE searches 
    SET last_run = CURRENT_TIMESTAMP 
    WHERE id = $1
  `;
  await pool.query(query, [searchId]);
}

async function getJobsByUser(userId) {
  const query = `
    SELECT * FROM vagas 
    WHERE user_id = $1 AND status = 'new'
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function markJobsAsSent(jobIds) {
  const query = `
    UPDATE vagas 
    SET status = 'sent' 
    WHERE id = ANY($1)
  `;
  await pool.query(query, [jobIds]);
}

// Modificar a função existente para incluir user_id
async function saveJobsToDatabase(jobs, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const job of jobs) {
      const query = `
        INSERT INTO vagas (
          cargo, cidade, estado, empresa, descricao, url, origem, 
          salario_minimo, salario, tipo_contrato, jornada, datapublicacao, 
          nivel, tipo, user_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'new')
        ON CONFLICT (url) DO UPDATE SET
          cargo = EXCLUDED.cargo,
          empresa = EXCLUDED.empresa,
          /* ... outros campos ... */
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        job.cargo,
        job.cidade,
        job.estado,
        job.empresa,
        job.descricao,
        job.url,
        job.origem,
        job.salario_minimo || null, // Novo campo: Salário mínimo
        job.salario || null, // Salário máximo
        job.tipo_contrato || null, // Tipo de contrato
        job.jornada || null, // Novo campo: Jornada de trabalho
        job.datapublicacao || null, // Data de publicação
        job.nivel || null, // Nível da vaga
        job.tipo || null, // Novo campo: Tipo
        userId,
      ];

      await client.query(query, values);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createSearch,
  getActiveSearches,
  updateSearchLastRun,
  getJobsByUser,
  markJobsAsSent,
  saveJobsToDatabase,
};
