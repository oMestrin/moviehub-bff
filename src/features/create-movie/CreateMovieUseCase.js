import { MoviesService } from "../../application/ports/MoviesService.js";

/** Caso de uso: cadastrar um filme (validação feita pelo MS1). */
export class CreateMovieUseCase {
  #movies;

  constructor({ moviesService }) {
    this.#movies = MoviesService.ensure(moviesService);
  }

  execute(input) {
    return this.#movies.create(input);
  }
}
