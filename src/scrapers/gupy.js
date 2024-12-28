const axios = require('axios');
const logger = require('../utils/logger');
const { parseISO, isAfter, subDays } = require('date-fns');

// -----------------------------------------------------------------------------
// 1. Mapeamento de tipos de vaga (tradução para PT-BR)
const TYPE_TRANSLATION = {
  vacancy_type_apprentice: 'Aprendiz',
  vacancy_type_associate: 'Associado',
  vacancy_type_talent_pool: 'Banco de Talentos',
  vacancy_type_effective: 'CLT',
  vacancy_type_internship: 'Estágio',
  vacancy_type_summer: 'Temporário de Verão',
  vacancy_type_temporary: 'Temporário',
  vacancy_type_outsource: 'Terceirizado',
  vacancy_type_trainee: 'Trainee',
  vacancy_type_volunteer: 'Voluntário',
  vacancy_legal_entity: 'PJ',
  vacancy_type_lecturer: 'Professor / Instrutor',
  vacancy_type_freelancer: 'Freelancer',
  vacancy_type_autonomous: 'Autônomo'
};

function translateType(type) {
  return TYPE_TRANSLATION[type] || type;
}

// -----------------------------------------------------------------------------
// 2. Mapeamento de estados para sigla
const STATE_ABBR_MAP = {
  'acre': 'AC',
  'ac': 'AC',
  'alagoas': 'AL',
  'al': 'AL',
  'amapa': 'AP',
  'ap': 'AP',
  'amazonas': 'AM',
  'am': 'AM',
  'bahia': 'BA',
  'ba': 'BA',
  'ceara': 'CE',
  'ce': 'CE',
  'distritofederal': 'DF',
  'df': 'DF',
  'espiritosanto': 'ES',
  'es': 'ES',
  'goias': 'GO',
  'go': 'GO',
  'maranhao': 'MA',
  'ma': 'MA',
  'matogrosso': 'MT',
  'mt': 'MT',
  'matogrossodosul': 'MS',
  'ms': 'MS',
  'minasgerais': 'MG',
  'mg': 'MG',
  'para': 'PA',
  'pa': 'PA',
  'paraiba': 'PB',
  'pb': 'PB',
  'parana': 'PR',
  'pr': 'PR',
  'pernambuco': 'PE',
  'pe': 'PE',
  'piaui': 'PI',
  'pi': 'PI',
  'riograndedonorte': 'RN',
  'rn': 'RN',
  'riograndedosul': 'RS',
  'rs': 'RS',
  'roraima': 'RR',
  'rr': 'RR',
  'rondonia': 'RO',
  'ro': 'RO',
  'riodejaneiro': 'RJ',
  'rj': 'RJ',
  'santacatarina': 'SC',
  'sc': 'SC',
  'saopaulo': 'SP',
  'sãopaulo': 'SP',
  'sp': 'SP',
  'sergipe': 'SE',
  'se': 'SE',
  'tocantins': 'TO',
  'to': 'TO'
};

function toStateAbbreviation(value) {
  if (!value) return '';
  let normalized = value
    .toLowerCase()
    .normalize('NFD') // remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ''); // remove espaços
  return STATE_ABBR_MAP[normalized] || '';
}

// Função para normalizar strings (cidade) para comparação parcial
function normalizeString(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// -----------------------------------------------------------------------------
// 3. Configurações da requisição
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/114.0.0.0 Safari/537.36 OPR/100.0.0.0 (Edition std-1)'
};
const API_URL = 'https://portal.api.gupy.io/api/job';

// -----------------------------------------------------------------------------
// 4. Filtro de data: vagas dos últimos 30 dias
const minDate = subDays(new Date(), 30);

// -----------------------------------------------------------------------------
/**
 * gupyScraper: Realiza a chamada na API da Gupy e retorna as vagas filtradas
 *
 * @param {string} jobTitle - Palavra-chave da vaga (ex: "auxiliar administrativo")
 * @param {string} city     - Cidade para filtrar (opcional)
 * @param {string} state    - Estado para filtrar (opcional)
 * @returns {Array} Lista de vagas formatadas
 */
async function gupyScraper(jobTitle, city = '', state = '') {
  logger.info(`Iniciando scraper Gupy para: ${jobTitle}`);

  try {
    // 1. Monta URL com offset=0 e limit=15
    const encodedJobTitle = encodeURIComponent(jobTitle);
    const url = `${API_URL}?name=${encodedJobTitle}&offset=0&limit=15`;
    logger.info('URL Gupy:', url);

    // 2. Faz a requisição
    const response = await axios.get(url, { headers: HEADERS });
    if (!response.data || !response.data.data) {
      logger.warn('Nenhum dado retornado da Gupy. Resposta:', response.data);
      return [];
    }

    // 3. Filtra por data (últimos 30 dias)
    let jobs = response.data.data;
    logger.info(
      `Total de vagas retornadas antes do filtro de data: ${jobs.length}`
    );

    jobs = jobs.filter((job) => {
      const { publishedDate } = job;
      if (!publishedDate) return false;
      const jobDate = parseISO(publishedDate);
      return isAfter(jobDate, minDate);
    });

    logger.info(
      `Total de vagas após filtro de data (últimos 30 dias): ${jobs.length}`
    );

    // 4. Filtro por cidade / estado (se fornecidos)
    if (city || state) {
      const searchCity = normalizeString(city);
      const searchState = toStateAbbreviation(state);

      jobs = jobs.filter((job) => {
        // Normaliza cidade do job
        const jobCity = normalizeString(job.city);
        // Converte estado do job para sigla
        const jobState = toStateAbbreviation(job.state);

        let cityMatch = true;
        if (searchCity) {
          // partial match
          cityMatch =
            jobCity.includes(searchCity) || searchCity.includes(jobCity);
        }

        let stateMatch = true;
        if (searchState) {
          // Exige match exato entre as siglas
          stateMatch = jobState === searchState;
        }

        return cityMatch && stateMatch;
      });

      logger.info(
        `Total de vagas após filtro de cidade/estado: ${jobs.length}`
      );
    }

    // 5. Formata o retorno final
    const formattedJobs = jobs.map((job) => ({
      cargo: job.name,
      empresa: job.careerPageName || 'Empresa Confidencial',
      cidade: job.city || '',
      estado: toStateAbbreviation(job.state || ''), // salva como sigla
      descricao: job.description,
      url: job.jobUrl || `https://vaga.gupy.io/${job.id}`,
      origem: 'Gupy',
      // Tradução do tipo
      tipo: translateType(job.type || ''),
      is_home_office: !!job.isRemoteWork,
      is_confidential: !job.careerPageName,
      data_publicacao: job.publishedDate ? job.publishedDate.split('T')[0] : null,
      salario_minimo: null,
      salario_maximo: null,
      nivel: null
    }));

    logger.info(
      `Total de vagas processadas para retorno: ${formattedJobs.length}`
    );

    return formattedJobs;
  } catch (error) {
    logger.error('Erro ao buscar dados da Gupy:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      jobTitle,
      city,
      state
    });
    return [];
  }
}

module.exports = gupyScraper;
