/** Infraestrutura — MS1 (filmes) via HTTP. Implementa a porta MoviesService. */
export class HttpMoviesService {
  #http;

  constructor(httpClient) {
    this.#http = httpClient;
  }

  list({ genre, search } = {}) {
    return this.#http.get("/movies", { genre, search });
  }

  get(id) {
    return this.#http.get(`/movies/${encodeURIComponent(id)}`);
  }

  create(input) {
    return this.#http.post("/movies", input);
  }

  update(id, input) {
    return this.#http.put(`/movies/${encodeURIComponent(id)}`, input);
  }

  async remove(id) {
    await this.#http.delete(`/movies/${encodeURIComponent(id)}`);
  }

  health() {
    return this.#http.get("/health");
  }
}
