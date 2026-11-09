import { ReviewsService } from "../../application/ports/ReviewsService.js";

/** Caso de uso: buscar uma avaliação (MS2). */
export class GetReviewUseCase {
  #reviews;

  constructor({ reviewsService }) {
    this.#reviews = ReviewsService.ensure(reviewsService);
  }

  execute(id) {
    return this.#reviews.get(id);
  }
}
