import { MoviesService } from "../../application/ports/MoviesService.js";

/** Caso de uso: remover um filme (MS1). */
export class DeleteMovieUseCase {
  #movies;

  constructor({ moviesService }) {
    this.#movies = MoviesService.ensure(moviesService);
  }

  execute(id) {
    return this.#movies.remove(id);
  }
}
