import { defineInterface } from "../../shared/kernel/defineInterface.js";

/**
 * Porta de saída — Azure Function de insights (gatilho HTTP).
 * calculate(movies) -> { totalMovies, totalReviews, topRated, byGenre, classifications, ... }
 */
export const InsightsService = defineInterface("InsightsService", ["calculate"]);
