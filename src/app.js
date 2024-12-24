// src/app.js
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocs = require("./docs/swagger");
const limiter = require("./middleware/rateLimiter");
const logger = require("./utils/logger");
const prometheus = require("prom-client");
const { scheduleCleanup } = require("./workers/cleanup");
const apiRoutes = require("./routes/api");
const config = require("config");

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.json());
app.use("/api", limiter);

app.use("/api", apiRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch (error) {
    res.status(500).send(error);
  }
});

app.use((error, req, res, next) => {
  logger.error("Erro na aplicação:", error);
  res.status(500).json({
    error: error.message,
    requestId: req.id,
  });
});

scheduleCleanup();

const PORT = config.get("server.port") || 3004;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});
