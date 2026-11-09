import express from "express";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./errorHandler.js";

/**
 * API — monta a aplicação Express a partir das slices.
 *
 * Único arquivo que importa o Express. Cada endpoint vem de uma slice
 * (features/<slice>/<slice>.endpoint.js) já com o seu caso de uso injetado
 * pelo composition root (container.js).
 */
export function createApp({ endpoints, openapi, serviceName, healthCheck = async () => ({}), logger = silentLogger, corsOrigin = "*" }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  if (corsOrigin) {
    app.use(cors(corsOrigin));
  }
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get("/health", async (req, res) => {
    try {
      res.json({ status: "ok", service: serviceName, checks: await healthCheck() });
    } catch (error) {
      logger.error(error);
      res.status(503).json({ status: "unavailable", service: serviceName });
    }
  });

  app.get("/openapi.json", (req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: `${serviceName} — Swagger` }));
  app.get("/", (req, res) => res.redirect("/docs"));

  for (const endpoint of endpoints) {
    app[endpoint.method](endpoint.path, endpoint.handler);
  }

  app.use((req, res) => res.status(404).json({ error: "NotFound", message: `Rota não encontrada: ${req.method} ${req.path}` }));
  app.use(errorHandler(logger));
  return app;
}

// CORS para chamadas diretas (ambiente local). No Azure o API Management cuida do CORS
// e o BFF sobe com CORS_ORIGIN vazio, para não duplicar os cabeçalhos.
function cors(origin) {
  return (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Ocp-Apim-Subscription-Key");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  };
}

const silentLogger = { info() {}, error() {} };
