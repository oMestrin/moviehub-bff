import { ReviewsService } from "../../application/ports/ReviewsService.js";

/** Caso de uso: remover uma avaliação (MS2). */
export class DeleteReviewUseCase {
  #reviews;

  constructor({ reviewsService }) {
    this.#reviews = ReviewsService.ensure(reviewsService);
  }

  execute(id) {
    return this.#reviews.remove(id);
  }
}
