const config = require("config");
const express = require("express");
const apiRoutes = require("./routes/api");

const app = express();
app.use(express.json());

app.use("/api", apiRoutes);

const PORT = config.get("server.port") || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
