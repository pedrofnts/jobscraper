const Joi = require("joi");

const jobSchema = Joi.object({
  cargo: Joi.string().required(),
  empresa: Joi.string().allow(null),
  cidade: Joi.string().allow(null),
  estado: Joi.string().allow(null),
  descricao: Joi.string().allow(null),
  url: Joi.string().required(),
  origem: Joi.string().required(),
  data_publicacao: Joi.string().allow(null),
  nivel: Joi.string().allow(null),
  tipo: Joi.string().allow(null),
  salario_minimo: Joi.number().allow(null),
  salario_maximo: Joi.number().allow(null),
  is_home_office: Joi.boolean().default(false),
  is_confidential: Joi.boolean().default(false),
});

function validateJob(job) {
  const { error, value } = jobSchema.validate(job);
  if (error) {
    throw new Error(`Invalid job structure: ${error.message}`);
  }
  return value;
}

module.exports = { validateJob };
