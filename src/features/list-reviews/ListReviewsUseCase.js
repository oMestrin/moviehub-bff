import { ReviewsService } from "../../application/ports/ReviewsService.js";

/** Caso de uso: listar avaliações (MS2), opcionalmente de um filme. */
export class ListReviewsUseCase {
  #reviews;

  constructor({ reviewsService }) {
    this.#reviews = ReviewsService.ensure(reviewsService);
  }

  execute({ movieId } = {}) {
    return this.#reviews.list({ movieId });
  }
}
