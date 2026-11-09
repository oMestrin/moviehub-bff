import { MoviesService } from "../../application/ports/MoviesService.js";

/** Caso de uso: listar filmes do catálogo (MS1), com filtro opcional. */
export class ListMoviesUseCase {
  #movies;

  constructor({ moviesService }) {
    this.#movies = MoviesService.ensure(moviesService);
  }

  execute({ genre, search } = {}) {
    return this.#movies.list({ genre, search });
  }
}
