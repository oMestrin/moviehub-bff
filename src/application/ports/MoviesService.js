import { defineInterface } from "../../shared/kernel/defineInterface.js";

/**
 * Porta de saída — microsserviço de filmes (MS1).
 * list({ genre, search }), get(id), create(input), update(id, input), remove(id)
 * get/update/remove lançam NotFoundError; create/update lançam ValidationError.
 */
export const MoviesService = defineInterface("MoviesService", ["list", "get", "create", "update", "remove"]);
