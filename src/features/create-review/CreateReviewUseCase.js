import { MoviesService } from "../../application/ports/MoviesService.js";
import { ReviewsService } from "../../application/ports/ReviewsService.js";
import { NotFoundError, ValidationError } from "../../domain/errors/index.js";

/**
 * Caso de uso: registrar uma avaliação.
 *
 * Os microsserviços não se conhecem, então é o BFF que garante que o filme
 * existe no catálogo (MS1) antes de gravar a avaliação no MS2.
 */
export class CreateReviewUseCase {
  #movies;
  #reviews;

  constructor({ moviesService, reviewsService }) {
    this.#movies = MoviesService.ensure(moviesService);
    this.#reviews = ReviewsService.ensure(reviewsService);
  }

  async execute(input) {
    if (typeof input?.movieId !== "string" || input.movieId.trim() === "") {
      throw new ValidationError('Campo "movieId" é obrigatório.');
    }
    try {
      await this.#movies.get(input.movieId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new ValidationError(`Filme ${input.movieId} não existe no catálogo.`);
      }
      throw error;
    }
    return this.#reviews.create(input);
  }
}
