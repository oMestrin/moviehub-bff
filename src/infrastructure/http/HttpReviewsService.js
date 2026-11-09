/** Infraestrutura — MS2 (avaliações) via HTTP. Implementa a porta ReviewsService. */
export class HttpReviewsService {
  #http;

  constructor(httpClient) {
    this.#http = httpClient;
  }

  list({ movieId } = {}) {
    return this.#http.get("/reviews", { movieId });
  }

  get(id) {
    return this.#http.get(`/reviews/${encodeURIComponent(id)}`);
  }

  create(input) {
    return this.#http.post("/reviews", input);
  }

  update(id, input) {
    return this.#http.put(`/reviews/${encodeURIComponent(id)}`, input);
  }

  async remove(id) {
    await this.#http.delete(`/reviews/${encodeURIComponent(id)}`);
  }

  stats() {
    return this.#http.get("/movie-stats");
  }

  health() {
    return this.#http.get("/health");
  }
}
