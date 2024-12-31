const pool = require("./config");

async function createSearch(search) {
  const { user_id, cargo, cidade, estado, whatsapp } = search;
  const query = `
    INSERT INTO searches (user_id, cargo, cidade, estado, whatsapp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await pool.query(query, [
    user_id,
    cargo,
    cidade,
    estado,
    whatsapp,
  ]);
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
    SELECT j.* 
    FROM jobs j
    JOIN user_jobs uj ON j.id = uj.job_id
    WHERE uj.user_id = $1 
    AND uj.sent_at IS NULL
    ORDER BY j.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function saveJobsToDatabase(jobs, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const job of jobs) {
      // Primeiro, insere ou atualiza na tabela jobs
      const jobQuery = `
        INSERT INTO jobs (
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
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        ON CONFLICT (url) DO UPDATE SET
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
          nivel = EXCLUDED.nivel
        RETURNING id
      `;

      const jobValues = [
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
      ];

      const jobResult = await client.query(jobQuery, jobValues);
      const jobId = jobResult.rows[0].id;

      // Depois, cria a relação na tabela user_jobs
      const userJobQuery = `
        INSERT INTO user_jobs (user_id, job_id, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, job_id) DO NOTHING
      `;

      await client.query(userJobQuery, [userId, jobId]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateSearchStatus(searchId, status) {
  const query = `
    UPDATE searches 
    SET status = $1, 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = $2
  `;
  await pool.query(query, [status, searchId]);
}

async function getUnsentJobs(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT j.* 
       FROM jobs j
       JOIN user_jobs uj ON j.id = uj.job_id
       WHERE uj.user_id = $1 
       AND uj.sent_at IS NULL
       ORDER BY j.data_publicacao DESC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function markJobsAsSent(jobIds, userId) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE user_jobs 
       SET sent_at = NOW() 
       WHERE job_id = ANY($1) 
       AND user_id = $2`,
      [jobIds, userId]
    );
  } finally {
    client.release();
  }
}

async function getUnsentJobsPrioritized(userId, limit = 5) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT j.* 
       FROM jobs j
       JOIN user_jobs uj ON j.id = uj.job_id
       WHERE uj.user_id = $1 
       AND uj.sent_at IS NULL
       ORDER BY 
         -- Prioriza vagas com mais informações
         (CASE WHEN j.salario_minimo IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN j.nivel IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN j.tipo IS NOT NULL THEN 1 ELSE 0 END +
          CASE WHEN j.descricao IS NOT NULL THEN 1 ELSE 0 END) DESC,
         -- Depois por data de publicação
         j.data_publicacao DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function findExistingSearch(userId) {
  const query = `
    SELECT * FROM searches 
    WHERE user_id = $1 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
}

async function updateExistingSearch(searchId, search) {
  const { cargo, cidade, estado, whatsapp } = search;
  const query = `
    UPDATE searches 
    SET cargo = $1,
        cidade = $2,
        estado = $3,
        whatsapp = $4,
        status = 'pending',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;
  const result = await pool.query(query, [
    cargo,
    cidade,
    estado,
    whatsapp,
    searchId,
  ]);
  return result.rows[0];
}

module.exports = {
  createSearch,
  getActiveSearches,
  updateSearchLastRun,
  getJobsByUser,
  markJobsAsSent,
  saveJobsToDatabase,
  updateSearchStatus,
  getUnsentJobs,
  getUnsentJobsPrioritized,
  findExistingSearch,
  updateExistingSearch,
};
