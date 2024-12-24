const { createBrowser } = require('../scraper-factory');
const logger = require("../utils/logger");

async function scrapeIndeed(jobTitle, city, state) {
  logger.info("Starting Indeed scraper...");
  const browser = await createBrowser();

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  const baseUrl = "https://br.indeed.com/jobs";
  const encodedJobTitle = encodeURIComponent(jobTitle);
  const encodedLocation = encodeURIComponent(`${city}, ${state}`);
  const url = `${baseUrl}?q=${encodedJobTitle}&l=${encodedLocation}&sort=date`;

  try {
    logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    logger.info("Ensuring full page load...");
    await autoScroll(page);

    logger.info("Extracting job data...");
    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".job_seen_beacon")).map((job) => {
        const cargoElement = job.querySelector("h2.jobTitle a");
        const empresaElement = job.querySelector("[data-testid='company-name']");
        const localizacaoElement = job.querySelector("[data-testid='text-location']");
        const salarioElement = job.querySelector(".metadata.salary-snippet-container div[data-testid='attribute_snippet_testid']");
        const descricaoElement = job.querySelector("div[data-testid='jobsnippet_footer']");
        const dataPublicacaoElement = job.querySelector("span[data-testid='myJobsStateDate']");
        const atributosElement = Array.from(
          job.querySelectorAll("li.metadata div[data-testid='attribute_snippet_testid']")
        ).map((el) => el.textContent.trim());

        let cidade = null;
        let estado = null;
        let tipo = null;
        if (localizacaoElement) {
          const localizacaoTexto = localizacaoElement.textContent.trim();
          const partes = localizacaoTexto.split(", ");
          cidade = partes[0]?.replace(/Home Office in|Modelo Híbrido in/i, "").trim() || null;
          estado = partes[1] || null;
          if (/Home Office/i.test(localizacaoTexto)) tipo = "Home Office";
          if (/Modelo Híbrido/i.test(localizacaoTexto)) tipo = "Modelo Híbrido";
        }

        let salario_minimo = null;
        let salario = null;
        if (salarioElement) {
          const salarioTexto = salarioElement.textContent.trim();
          const valores = salarioTexto
            .replace(/[^\d,–]/g, "")
            .split("–")
            .map((v) => parseFloat(v.replace(".", "").replace(",", ".")));
          salario_minimo = valores.length > 0 ? valores[0] : null;
          salario = valores.length > 1 ? valores[1] : salario_minimo;
        }

        const descricao = descricaoElement
          ? descricaoElement.textContent.replace("Descrição da oferta:", "").trim()
          : null;

        let tipo_contrato = null;
        let jornada = null;
        atributosElement.forEach((atributo) => {
          if (
            /Efetivo CLT|Estágio \/ Trainee|Aprendiz|Temporário|Meio período|Autônomo \/ PJ|Intermitente \(freelance\)/i.test(
              atributo
            )
          ) {
            tipo_contrato = atributo;
          } else if (
            /Tempo integral|De segunda à sexta-feira|Turno de 8 horas|Turno diário|Turno de 12 horas|Turno rotativo|Dias úteis e finais de semana|Dias úteis e feriados|Turno Noturno|Turno vespertino|Apenas finais de semana/i.test(
              atributo
            )
          ) {
            jornada = atributo;
          }
        });

        const dataPublicacao = dataPublicacaoElement
          ? dataPublicacaoElement.textContent.replace(/Employer|Ativa há /i, "").trim()
          : null;

        return {
          cargo: cargoElement ? cargoElement.textContent.trim() : null,
          empresa: empresaElement ? empresaElement.textContent.trim() : null,
          cidade,
          estado,
          salario_minimo,
          salario,
          tipo_contrato,
          jornada,
          tipo,
          descricao,
          datapublicacao: dataPublicacao,
          url: cargoElement
            ? "https://br.indeed.com" + cargoElement.getAttribute("href")
            : null,
          origem: "indeed.com",
        };
      });
    });

    logger.info(`Extracted ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    logger.error("Error scraping Indeed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

module.exports = scrapeIndeed;
