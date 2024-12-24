const Joi = require("joi");

const searchSchema = Joi.object({
  user_id: Joi.string().required(),
  cargo: Joi.string().required().min(3),
  cidade: Joi.string().required(),
  estado: Joi.string().length(2).required(),
});

const jobIdsSchema = Joi.object({
  jobIds: Joi.array().items(Joi.number()).min(1).required(),
});

module.exports = {
  searchSchema,
  jobIdsSchema,
};
