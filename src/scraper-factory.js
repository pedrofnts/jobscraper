const puppeteer = require("puppeteer");
const logger = require("./utils/logger");

async function createBrowser() {
  try {
    return await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    });
  } catch (error) {
    logger.error("Error creating browser:", error);
    throw error;
  }
}

module.exports = { createBrowser };
