const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");

// State mapping for Brazil
const stateMapping = {
  'são paulo': 'SP',
  'rio de janeiro': 'RJ',
  'minas gerais': 'MG',
  'espirito santo': 'ES',
  'bahia': 'BA',
  'sergipe': 'SE',
  'alagoas': 'AL',
  'pernambuco': 'PE',
  'paraíba': 'PB',
  'rio grande do norte': 'RN',
  'ceará': 'CE',
  'piauí': 'PI',
  'maranhão': 'MA',
  'pará': 'PA',
  'amapá': 'AP',
  'amazonas': 'AM',
  'roraima': 'RR',
  'acre': 'AC',
  'rondônia': 'RO',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'goiás': 'GO',
  'distrito federal': 'DF',
  'paraná': 'PR',
  'santa catarina': 'SC',
  'rio grande do sul': 'RS',
  'tocantins': 'TO'
};

// Utility functions
function normalizeState(location) {
  if (!location) return 'NA';
  
  // Try to find state code in the location string
  const locationLower = location.toLowerCase().trim();
  for (const [fullName, code] of Object.entries(stateMapping)) {
    if (locationLower.includes(fullName)) {
      return code;
    }
  }
  
  // If no match found, return default
  return 'NA';
}

function parseLocation(locationString) {
  if (!locationString) return { cidade: 'NA', estado: 'NA' };
  
  const parts = locationString.split(',').map(part => part.trim());
  if (parts.length >= 2) {
    return {
      cidade: parts[0] || 'NA',
      estado: normalizeState(parts[1])
    };
  }
  
  return {
    cidade: parts[0] || 'NA',
    estado: 'NA'
  };
}

async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      logger.warn(`Attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

function parseSalary(salaryText) {
  if (!salaryText) return [null, null];
  
  const numbers = salaryText.match(/[\d,.]+/g);
  if (!numbers || numbers.length === 0) return [null, null];
  
  const values = numbers.map(n => parseFloat(n.replace(/[,.]/g, '')));
  return [
    values[0] || null,
    values[values.length - 1] || null
  ];
}

async function linkedinScraper(jobTitle, city, state) {
  logger.info("Starting LinkedIn scraper...");
  const browser = await createBrowser();

  try {
    const page = await browser.newPage();
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Build search URL
    const searchLocation = `${city}, ${state}`;
    const url = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(jobTitle)}&location=${encodeURIComponent(searchLocation)}&sortBy=DD&position=1&pageNum=0`;

    logger.info(`Navigating to ${url}`);
    
    // Navigate and wait for content
    await retryOperation(async () => {
      await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 60000 
      });
    });

    await page.waitForSelector('.jobs-search__results-list', { timeout: 30000 });

    // Extract job data
    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.jobs-search__results-list > li');
      return Array.from(cards).map(card => {
        const link = card.querySelector('a.base-card__full-link');
        const title = card.querySelector('.base-search-card__title');
        const company = card.querySelector('.base-search-card__subtitle');
        const location = card.querySelector('.job-search-card__location');
        const date = card.querySelector('time');
        const salary = card.querySelector('.job-search-card__salary-info');
        
        return {
          cargo: title?.textContent?.trim() || 'N/A',
          empresa: company?.textContent?.trim() || 'N/A',
          local: location?.textContent?.trim() || '',
          url: link?.href || 'N/A',
          origem: 'LinkedIn',
          salario: salary?.textContent?.trim() || null,
          data_raw: date?.dateTime || null
        };
      });
    });

    // Process extracted data
    const processedJobs = jobs.map(job => {
      const location = parseLocation(job.local);
      
      return {
        cargo: job.cargo,
        empresa: job.empresa,
        cidade: location.cidade,
        estado: location.estado,
        url: job.url,
        origem: job.origem,
        data_publicacao: job.data_raw ? 
          new Date(job.data_raw).toISOString().split('T')[0] : 
          null,
        salario_minimo: null,
        salario_maximo: null,
        nivel: null,
        is_home_office: job.local.toLowerCase().includes('remote'),
        is_confidential: false
      };
    });

    logger.info(`Found ${processedJobs.length} jobs`);
    return processedJobs;

  } catch (error) {
    logger.error("Error scraping LinkedIn:", error);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = linkedinScraper;