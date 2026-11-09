import { Clock } from "../../application/ports/Clock.js";
import { InsightsService } from "../../application/ports/InsightsService.js";
import { MoviesService } from "../../application/ports/MoviesService.js";
import { ReviewsService } from "../../application/ports/ReviewsService.js";
import { buildAggregatedData, withMembersRating } from "../../domain/aggregation.js";

/**
 * Caso de uso: montar a visão agregada do catálogo.
 *
 * 1. Em paralelo: filmes (MS1), estatísticas e avaliações (MS2).
 * 2. Com os filmes já com a nota dos membros, pede os insights à Function.
 *
 * O catálogo é obrigatório (sem ele a falha sobe). Se o MS2 ou a Function
 * estiverem fora, a resposta sai mesmo assim, marcando a fonte como
 * "unavailable" em `sources`.
 */
export class GetAggregatedDataUseCase {
  #movies;
  #reviews;
  #insights;
  #clock;
  #logger;

  constructor({ moviesService, reviewsService, insightsService, clock, logger = { error() {} } }) {
    this.#movies = MoviesService.ensure(moviesService);
    this.#reviews = ReviewsService.ensure(reviewsService);
    this.#insights = InsightsService.ensure(insightsService);
    this.#clock = Clock.ensure(clock);
    this.#logger = logger;
  }

  async execute() {
    const [movies, stats, reviews] = await Promise.allSettled([this.#movies.list({}), this.#reviews.stats(), this.#reviews.list({})]);
    if (movies.status === "rejected") {
      throw movies.reason;
    }
    const statsValue = this.#valueOrNull(stats);
    const reviewsValue = this.#valueOrNull(reviews);

    let insights = null;
    try {
      insights = await this.#insights.calculate(withMembersRating(movies.value, statsValue));
    } catch (error) {
      this.#logger.error(error);
    }

    return buildAggregatedData({ movies: movies.value, stats: statsValue, reviews: reviewsValue, insights, now: this.#clock.now() });
  }

  #valueOrNull(result) {
    if (result.status === "fulfilled") {
      return result.value;
    }
    this.#logger.error(result.reason);
    return null;
  }
}
