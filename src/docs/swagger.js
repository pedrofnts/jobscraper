const swaggerJsDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Job Scraper API",
      version: "1.0.0",
      description: "API para scraping de vagas de emprego",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor de desenvolvimento",
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsDoc(options);
