import { defineInterface } from "../../shared/kernel/defineInterface.js";

/**
 * Porta de saída — microsserviço de avaliações (MS2).
 * list({ movieId }), get(id), create(input), update(id, input), remove(id),
 * stats() -> [{ movieId, average, count }]
 */
export const ReviewsService = defineInterface("ReviewsService", ["list", "get", "create", "update", "remove", "stats"]);
