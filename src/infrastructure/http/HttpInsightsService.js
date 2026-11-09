/**
 * Infraestrutura — Azure Function de insights (gatilho HTTP, authLevel
 * "function"). A chave vai no cabeçalho x-functions-key.
 * Implementa a porta InsightsService.
 */
export class HttpInsightsService {
  #http;

  constructor(httpClient) {
    this.#http = httpClient;
  }

  calculate(movies) {
    const body = movies.map(({ id, title, genre, rating, membersRating }) => ({ id, title, genre, rating, membersRating }));
    return this.#http.post("", { movies: body });
  }
}
