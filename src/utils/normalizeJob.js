function normalizeJob(job) {
  return {
    cargo: job.cargo || null,
    empresa: job.empresa || null,
    cidade: job.cidade || null,
    estado: job.estado || null,
    descricao: job.descricao || null,
    url: job.url || null,
    origem: job.origem || null,
    data_publicacao: job.data_publicacao || null,
    nivel: job.nivel || null,
    tipo: job.tipo || null,
    salario_minimo: job.salario_minimo || null,
    salario_maximo: job.salario_maximo || null,
    is_home_office: job.is_home_office || false,
    is_confidential: job.is_confidential || false,
  };
}

module.exports = { normalizeJob };
