import { createApp } from "./api/createApp.js";
import { openapi } from "./api/openapi.js";
import { CreateMovieUseCase } from "./features/create-movie/CreateMovieUseCase.js";
import { createMovieEndpoint } from "./features/create-movie/createMovie.endpoint.js";
import { CreateReviewUseCase } from "./features/create-review/CreateReviewUseCase.js";
import { createReviewEndpoint } from "./features/create-review/createReview.endpoint.js";
import { DeleteMovieUseCase } from "./features/delete-movie/DeleteMovieUseCase.js";
import { deleteMovieEndpoint } from "./features/delete-movie/deleteMovie.endpoint.js";
import { DeleteReviewUseCase } from "./features/delete-review/DeleteReviewUseCase.js";
import { deleteReviewEndpoint } from "./features/delete-review/deleteReview.endpoint.js";
import { GetAggregatedDataUseCase } from "./features/get-aggregated-data/GetAggregatedDataUseCase.js";
import { getAggregatedDataEndpoint } from "./features/get-aggregated-data/getAggregatedData.endpoint.js";
import { GetMovieUseCase } from "./features/get-movie/GetMovieUseCase.js";
import { getMovieEndpoint } from "./features/get-movie/getMovie.endpoint.js";
import { GetReviewUseCase } from "./features/get-review/GetReviewUseCase.js";
import { getReviewEndpoint } from "./features/get-review/getReview.endpoint.js";
import { ListMoviesUseCase } from "./features/list-movies/ListMoviesUseCase.js";
import { listMoviesEndpoint } from "./features/list-movies/listMovies.endpoint.js";
import { ListReviewsUseCase } from "./features/list-reviews/ListReviewsUseCase.js";
import { listReviewsEndpoint } from "./features/list-reviews/listReviews.endpoint.js";
import { UpdateMovieUseCase } from "./features/update-movie/UpdateMovieUseCase.js";
import { updateMovieEndpoint } from "./features/update-movie/updateMovie.endpoint.js";
import { UpdateReviewUseCase } from "./features/update-review/UpdateReviewUseCase.js";
import { updateReviewEndpoint } from "./features/update-review/updateReview.endpoint.js";
import { HttpClient } from "./infrastructure/http/HttpClient.js";
import { HttpInsightsService } from "./infrastructure/http/HttpInsightsService.js";
import { HttpMoviesService } from "./infrastructure/http/HttpMoviesService.js";
import { HttpReviewsService } from "./infrastructure/http/HttpReviewsService.js";
import { SystemClock } from "./infrastructure/SystemClock.js";

/** Cria os clientes HTTP reais a partir da configuração. */
export function httpServices({ moviesServiceUrl, reviewsServiceUrl, insightsFunctionUrl, insightsFunctionKey, timeoutMs }) {
  return {
    moviesService: new HttpMoviesService(new HttpClient({ service: "ms-filmes", baseUrl: moviesServiceUrl, timeoutMs })),
    reviewsService: new HttpReviewsService(new HttpClient({ service: "ms-avaliacoes", baseUrl: reviewsServiceUrl, timeoutMs })),
    insightsService: new HttpInsightsService(
      new HttpClient({
        service: "function-insights",
        baseUrl: insightsFunctionUrl,
        headers: insightsFunctionKey ? { "x-functions-key": insightsFunctionKey } : {},
        timeoutMs
      })
    )
  };
}

/**
 * Composition root: liga serviços -> casos de uso -> endpoints.
 * Nova funcionalidade = nova pasta em features/ + uma linha na lista abaixo.
 */
export function buildApp({ moviesService, reviewsService, insightsService, clock = new SystemClock(), logger, corsOrigin }) {
  const deps = { moviesService, reviewsService, insightsService, clock, logger };

  const endpoints = [
    getAggregatedDataEndpoint({ useCase: new GetAggregatedDataUseCase(deps) }),
    listMoviesEndpoint({ useCase: new ListMoviesUseCase(deps) }),
    getMovieEndpoint({ useCase: new GetMovieUseCase(deps) }),
    createMovieEndpoint({ useCase: new CreateMovieUseCase(deps) }),
    updateMovieEndpoint({ useCase: new UpdateMovieUseCase(deps) }),
    deleteMovieEndpoint({ useCase: new DeleteMovieUseCase(deps) }),
    listReviewsEndpoint({ useCase: new ListReviewsUseCase(deps) }),
    getReviewEndpoint({ useCase: new GetReviewUseCase(deps) }),
    createReviewEndpoint({ useCase: new CreateReviewUseCase(deps) }),
    updateReviewEndpoint({ useCase: new UpdateReviewUseCase(deps) }),
    deleteReviewEndpoint({ useCase: new DeleteReviewUseCase(deps) })
  ];

  return createApp({
    endpoints,
    openapi,
    serviceName: "bff",
    healthCheck: () => upstreamHealth({ "ms-filmes": moviesService, "ms-avaliacoes": reviewsService }),
    logger,
    corsOrigin
  });
}

// o BFF continua "ok" mesmo com um serviço fora; só informa o estado de cada um
async function upstreamHealth(services) {
  const entries = await Promise.all(
    Object.entries(services).map(async ([name, service]) => {
      if (typeof service.health !== "function") {
        return [name, "unknown"];
      }
      try {
        await service.health();
        return [name, "ok"];
      } catch {
        return [name, "unavailable"];
      }
    })
  );
  return Object.fromEntries(entries);
}
