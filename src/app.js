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
const timeout = require('connect-timeout');

const app = express();

app.use(timeout('30s'));
app.use(haltOnTimedout);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      db: {
        host: config.get("database.host"),
        port: config.get("database.port"),
        connected: true
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
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

function haltOnTimedout(req, res, next) {
  if (!req.timedout) next();
}

const PORT = config.get("server.port") || 3004;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Database host: ${config.get("database.host")}`);
});
