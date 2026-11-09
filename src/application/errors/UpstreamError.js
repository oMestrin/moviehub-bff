/** Falha ao chamar outro serviço (rede, timeout ou resposta 5xx). */
export class UpstreamError extends Error {
  constructor(service, message) {
    super(`${service}: ${message}`);
    this.name = "UpstreamError";
    this.service = service;
  }
}
