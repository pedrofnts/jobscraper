const pool = require("./config");

async function saveJobsToDatabase(jobs) {
  console.log("Starting to save jobs to database");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const job of jobs) {
      const query = `
        INSERT INTO vagas (cargo, cidade, estado, empresa, descricao, url, origem)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (url) DO UPDATE SET
        cargo = EXCLUDED.cargo,
        empresa = EXCLUDED.empresa,
        descricao = EXCLUDED.descricao,
        cidade = EXCLUDED.cidade,
        estado = EXCLUDED.estado,
        origem = EXCLUDED.origem,
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
      ];
      await client.query(query, values);
    }
    await client.query("COMMIT");
    console.log(`Successfully saved ${jobs.length} jobs to the database.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving jobs to database:", error);
    console.error("Detailed error:", error.message);
    if (error.detail) console.error("Error detail:", error.detail);
  } finally {
    client.release();
  }
}

module.exports = {
  saveJobsToDatabase,
};
