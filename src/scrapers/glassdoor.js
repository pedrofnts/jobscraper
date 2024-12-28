const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");
const axios = require('axios');

// Add HTML parsing helper function
function cleanHtmlDescription(html) {
  if (!html) return null;
  
  return html
    // Replace common HTML elements with text equivalents
    .replace(/<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<li>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<ul>|<\/ul>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    // Replace italic and bold with plain text
    .replace(/<\/?[bi]>/gi, '')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Convert common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ')
    .replace(/&aacute;/g, 'á')
    .replace(/&iacute;/g, 'í')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&ordm;/g, 'º')
    // Remove multiple newlines
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

const FALLBACK_TOKEN = "Ft6oHEWlRZrxDww95Cpazw:0pGUrkb2y3TyOpAIqF2vbPmUXoXVkD3oEGDVkvfeCerceQ5-n8mBg3BovySUIjmCPHCaW0H2nQVdqzbtsYqf4Q:wcqRqeegRUa9MVLJGyujVXB7vWFPjdaS1CtrrzJq-ok";

async function getJobDescription(jobId) {
  try {
    const response = await axios.post('https://www.glassdoor.com.br/graph', [{
      operationName: "JobDetailQuery",
      variables: {
        jl: jobId,
        queryString: "q",
        pageTypeEnum: "SERP"
      },
      query: `
      query JobDetailQuery($jl: Long!, $queryString: String, $pageTypeEnum: PageTypeEnum) {
        jobview: jobView(
          listingId: $jl
          contextHolder: {queryString: $queryString, pageTypeEnum: $pageTypeEnum}
        ) {
          job {
            description
            __typename
          }
          __typename
        }
      }`
    }], {
      headers: {
        "accept": "*/*",
        "accept-language": "pt-BR,pt;q=0.9",
        "apollographql-client-name": "job-search-next",
        "apollographql-client-version": "4.65.5",
        "content-type": "application/json",
        "gd-csrf-token": FALLBACK_TOKEN,
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    // Log para debug
    logger.info(`Description response for job ${jobId}:`, response.data);

    return response.data[0]?.data?.jobview?.job?.description;
  } catch (error) {
    logger.error(`Error getting job description for ${jobId}:`, error.response?.data || error);
    return null;
  }
}

async function glassdoorScraper(jobTitle, city, state) {
  logger.info("Starting Glassdoor.com.br scraper...");
  
  try {
    const response = await axios.post('https://www.glassdoor.com.br/graph', [{
      operationName: "JobSearchResultsQuery",
      variables: {
        keyword: jobTitle,
        locationId: 0,
        locationType: "CITY",
        numJobsToShow: 30,
        pageNumber: 1,
        filterParams: [],
        parameterUrlInput: `${city}, ${state}`,
        sortBy: "DATE_DESC"
      },
      query: `query JobSearchResultsQuery($keyword: String!, $locationId: Int, $locationType: LocationTypeEnum, $numJobsToShow: Int!, $pageNumber: Int, $filterParams: [FilterParams], $parameterUrlInput: String) {
        jobListings(contextHolder: {searchParams: {keyword: $keyword, locationId: $locationId, locationType: $locationType, numPerPage: $numJobsToShow, pageNumber: $pageNumber, filterParams: $filterParams, parameterUrlInput: $parameterUrlInput}}) {
          jobListings {
            jobview {
              job {
                jobTitleText
                listingId
                description
              }
              header {
                employerNameFromSearch
                locationName
                ageInDays
                payPeriod
                payPeriodAdjustedPay {
                  p10
                  p90
                }
              }
            }
          }
        }
      }`
    }], {
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'apollographql-client-name': 'job-search-next',
        'apollographql-client-version': '4.65.5',
        'gd-csrf-token': FALLBACK_TOKEN,
        'accept-language': 'pt-BR,pt;q=0.9',
        'origin': 'https://www.glassdoor.com.br',
        'referer': 'https://www.glassdoor.com.br/Vagas/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response?.data?.[0]?.data?.jobListings?.jobListings) {
      logger.error('Invalid response format:', response.data);
      return [];
    }

    const jobs = response.data[0].data.jobListings.jobListings;

    // Obter descrições individualmente
    const jobsWithDescriptions = await Promise.all(
      jobs.map(async (job) => {
        const description = await getJobDescription(job.jobview.job.listingId);
        return {
          ...job,
          jobview: {
            ...job.jobview,
            job: {
              ...job.jobview.job,
              description
            }
          }
        };
      })
    );

    const processedJobs = jobsWithDescriptions.map(job => ({
      cargo: job.jobview?.job?.jobTitleText,
      empresa: job.jobview?.header?.employerNameFromSearch || 'Empresa Confidencial',
      cidade: city,
      estado: state,
      url: `https://www.glassdoor.com.br/Vaga/vaga-JV_IC${job.jobview?.job?.listingId}.htm`,
      origem: 'Glassdoor',
      data_publicacao: job.jobview?.header?.ageInDays ? 
        new Date(Date.now() - (job.jobview.header.ageInDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] : 
        null,
      salario_minimo: job.jobview?.header?.payPeriodAdjustedPay?.p10 || null,
      salario_maximo: job.jobview?.header?.payPeriodAdjustedPay?.p90 || null,
      nivel: null,
      descricao: cleanHtmlDescription(job.jobview?.job?.description),
      is_home_office: job.jobview?.header?.locationName.toLowerCase().includes('remoto'),
      is_confidential: !job.jobview?.header?.employerNameFromSearch
    }));

    return processedJobs;

  } catch (error) {
    logger.error("Error scraping Glassdoor:", error.response?.data || error);
    return [];
  }
}

module.exports = glassdoorScraper;