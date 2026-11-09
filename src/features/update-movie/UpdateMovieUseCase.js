import { MoviesService } from "../../application/ports/MoviesService.js";

/** Caso de uso: alterar um filme (MS1). */
export class UpdateMovieUseCase {
  #movies;

  constructor({ moviesService }) {
    this.#movies = MoviesService.ensure(moviesService);
  }

  execute(id, input) {
    return this.#movies.update(id, input);
  }
}
