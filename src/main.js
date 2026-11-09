import { buildApp, httpServices } from "./container.js";

/**
 * Ponto de entrada do BFF.
 *
 *   PORT                    porta HTTP (padrão 3000)
 *   MOVIES_SERVICE_URL      URL do microsserviço de filmes
 *   REVIEWS_SERVICE_URL     URL do microsserviço de avaliações
 *   INSIGHTS_FUNCTION_URL   URL do gatilho HTTP da Function (…/api/insights)
 *   INSIGHTS_FUNCTION_KEY   chave da função (cabeçalho x-functions-key)
 *   UPSTREAM_TIMEOUT_MS     timeout das chamadas (padrão 8000)
 *   CORS_ORIGIN             origem liberada no CORS (padrão "*"; vazio desliga — no Azure quem faz é o APIM)
 */
const port = Number(process.env.PORT ?? 3000);
const logger = {
  info: (message) => console.log(`[bff] ${message}`),
  error: (error) => console.error("[bff]", error?.message ?? error)
};

const services = httpServices({
  moviesServiceUrl: process.env.MOVIES_SERVICE_URL ?? "http://localhost:3001",
  reviewsServiceUrl: process.env.REVIEWS_SERVICE_URL ?? "http://localhost:3002",
  insightsFunctionUrl: process.env.INSIGHTS_FUNCTION_URL ?? "http://localhost:7071/api/insights",
  insightsFunctionKey: process.env.INSIGHTS_FUNCTION_KEY,
  timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 8000)
});

const corsOrigin = process.env.CORS_ORIGIN ?? "*";

const server = buildApp({ ...services, logger, corsOrigin }).listen(port, () => {
  logger.info(`ouvindo na porta ${server.address().port} — Swagger em /docs`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
