import { ReviewsService } from "../../application/ports/ReviewsService.js";

/** Caso de uso: alterar nota e comentário de uma avaliação (MS2). */
export class UpdateReviewUseCase {
  #reviews;

  constructor({ reviewsService }) {
    this.#reviews = ReviewsService.ensure(reviewsService);
  }

  execute(id, input) {
    return this.#reviews.update(id, input);
  }
}
