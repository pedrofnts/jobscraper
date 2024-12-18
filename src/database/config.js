const config = require("config");
const { Pool } = require("pg");

const dbConfig = config.get("database");

const pool = new Pool({
  user: dbConfig.user,
  host: dbConfig.host,
  database: dbConfig.name,
  password: dbConfig.password,
  port: dbConfig.port,
});

module.exports = pool;
