const express = require("express");
const { getScraper } = require("../scraper-factory");
const { saveJobsToDatabase } = require("../database/operations");

const router = express.Router();

router.post("/scrape", async (req, res) => {
  const { site, jobTitle, city, state } = req.body;
  if (site) {
    // Scrape a single site
    try {
      const scraper = getScraper(site);
      const jobs = await scraper(jobTitle, city, state);
      await saveJobsToDatabase(jobs);
      res.json({ message: `Scraped and saved ${jobs.length} jobs from ${site}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    // Scrape all sites
    const scrapers = require("../scraper-factory").scrapers;
    const results = {};

    for (const [siteName, scraper] of Object.entries(scrapers)) {
      try {
        const jobs = await scraper(jobTitle, city, state);
        await saveJobsToDatabase(jobs);
        results[siteName] = { status: "success", jobs: jobs.length };
      } catch (error) {
        results[siteName] = { status: "error", message: error.message };
      }
    }

    res.json({ results });
  }
});

module.exports = router;
