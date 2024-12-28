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

async function saveJobsToDatabase(jobs, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const job of jobs) {
      const query = `
        INSERT INTO vagas (
          cargo,
          empresa,
          cidade,
          estado,
          descricao,
          url,
          origem,
          tipo,
          is_home_office,
          is_confidential,
          data_publicacao,
          salario_minimo,
          salario_maximo,
          nivel,
          user_id,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (url, user_id) DO UPDATE SET
          cargo = EXCLUDED.cargo,
          empresa = EXCLUDED.empresa,
          cidade = EXCLUDED.cidade,
          estado = EXCLUDED.estado,
          descricao = EXCLUDED.descricao,
          origem = EXCLUDED.origem,
          tipo = EXCLUDED.tipo,
          is_home_office = EXCLUDED.is_home_office,
          is_confidential = EXCLUDED.is_confidential,
          data_publicacao = EXCLUDED.data_publicacao,
          salario_minimo = EXCLUDED.salario_minimo,
          salario_maximo = EXCLUDED.salario_maximo,
          nivel = EXCLUDED.nivel,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `;

      const values = [
        job.cargo,
        job.empresa || null,
        job.cidade || null,
        job.estado || null,
        job.descricao || null,
        job.url,
        job.origem || null,
        job.tipo || null,
        job.is_home_office || false,
        job.is_confidential || false,
        job.data_publicacao || null,
        job.salario_minimo || null,
        job.salario_maximo || null,
        job.nivel || null,
        userId,
        'new'
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
