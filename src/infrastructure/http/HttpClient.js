import { UpstreamError } from "../../application/errors/UpstreamError.js";
import { NotFoundError, ValidationError } from "../../domain/errors/index.js";

/**
 * Infraestrutura — cliente HTTP genérico para os serviços de trás do BFF.
 *
 * Traduz as respostas para os erros que as camadas internas conhecem:
 *   400 -> ValidationError (mensagem do serviço)
 *   404 -> NotFoundError   (mensagem do serviço)
 *   rede, timeout, 5xx ou outro 4xx -> UpstreamError
 */
export class HttpClient {
  #service;
  #baseUrl;
  #headers;
  #timeoutMs;

  constructor({ service, baseUrl, headers = {}, timeoutMs = 8000 }) {
    this.#service = service;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#headers = headers;
    this.#timeoutMs = timeoutMs;
  }

  get(path, query) {
    return this.request("GET", withQuery(path, query));
  }

  post(path, body) {
    return this.request("POST", path, body);
  }

  put(path, body) {
    return this.request("PUT", path, body);
  }

  delete(path) {
    return this.request("DELETE", path);
  }

  async request(method, path, body) {
    const url = `${this.#baseUrl}${path}`;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...this.#headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.#timeoutMs)
      });
    } catch (error) {
      throw new UpstreamError(this.#service, `${method} ${path} falhou: ${error.message}`);
    }

    const payload = await readJson(response);
    if (response.ok) {
      return payload;
    }
    const message = payload?.message ?? `${method} ${path} respondeu ${response.status}`;
    if (response.status === 400) {
      throw new ValidationError(message);
    }
    if (response.status === 404) {
      throw new NotFoundError(message);
    }
    throw new UpstreamError(this.#service, `${method} ${path} respondeu ${response.status}`);
  }
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
