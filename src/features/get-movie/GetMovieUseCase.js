import { MoviesService } from "../../application/ports/MoviesService.js";

/** Caso de uso: buscar um filme (MS1). */
export class GetMovieUseCase {
  #movies;

  constructor({ moviesService }) {
    this.#movies = MoviesService.ensure(moviesService);
  }

  execute(id) {
    return this.#movies.get(id);
  }
}
