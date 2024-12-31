const Joi = require("joi");

const searchSchema = Joi.object({
  user_id: Joi.number().required(),
  cargo: Joi.string().required().min(3).max(100),
  cidade: Joi.string().required().min(2).max(100),
  estado: Joi.string().required().length(2),
  whatsapp: Joi.string()
    .required()
    .pattern(/^55[0-9]{10,11}$/)
    .messages({
      "string.pattern.base":
        "O número do WhatsApp deve começar com 55 (código do Brasil) seguido de DDD e número (10 ou 11 dígitos no total)",
    }),
});

const jobIdsSchema = Joi.object({
  jobIds: Joi.array().items(Joi.number()).min(1).required(),
});

module.exports = {
  searchSchema,
  jobIdsSchema,
};
