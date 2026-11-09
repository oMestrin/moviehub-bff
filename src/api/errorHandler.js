import { UpstreamError } from "../application/errors/UpstreamError.js";
import { NotFoundError, ValidationError } from "../domain/errors/index.js";

/**
 * API — traduz erros em respostas HTTP.
 * Erros de validação e "não encontrado" vindos dos microsserviços são
 * repassados ao cliente; falha de um serviço vira 502.
 */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: "ValidationError", message: error.message });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: "NotFound", message: error.message });
    }
    if (error instanceof UpstreamError) {
      logger.error(error);
      return res.status(502).json({ error: "BadGateway", message: `Serviço ${error.service} indisponível no momento.` });
    }
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "ValidationError", message: "JSON inválido no corpo da requisição." });
    }
    logger.error(error);
    return res.status(500).json({ error: "InternalError", message: "Erro interno no servidor." });
  };
}
