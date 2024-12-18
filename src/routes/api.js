const express = require("express");
const { getScraper } = require("../scraper-factory");
const { saveJobsToDatabase } = require("../database/operations");

const router = express.Router();

router.post("/scrape", async (req, res) => {
  const { site, jobTitle, city, state } = req.body;
  try {
    const scraper = getScraper(site);
    const jobs = await scraper(jobTitle, city, state);
    await saveJobsToDatabase(jobs);
    res.json({ message: `Scraped and saved ${jobs.length} jobs from ${site}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
