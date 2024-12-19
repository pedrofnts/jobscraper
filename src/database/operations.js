const pool = require("./config");

async function saveJobsToDatabase(jobs) {
  console.log("Starting to save jobs to database");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const job of jobs) {
      const query = `
        INSERT INTO vagas (
          cargo, cidade, estado, empresa, descricao, url, origem, 
          salario_minimo, salario, tipo_contrato, jornada, datapublicacao, nivel, tipo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (url) DO UPDATE SET
          cargo = EXCLUDED.cargo,
          empresa = EXCLUDED.empresa,
          descricao = EXCLUDED.descricao,
          cidade = EXCLUDED.cidade,
          estado = EXCLUDED.estado,
          origem = EXCLUDED.origem,
          salario_minimo = EXCLUDED.salario_minimo,
          salario = EXCLUDED.salario,
          tipo_contrato = EXCLUDED.tipo_contrato,
          jornada = EXCLUDED.jornada,
          datapublicacao = EXCLUDED.datapublicacao,
          nivel = EXCLUDED.nivel,
          tipo = EXCLUDED.tipo,
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
