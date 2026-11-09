import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GetAggregatedDataUseCase } from "../../src/features/get-aggregated-data/GetAggregatedDataUseCase.js";
import { CreateReviewUseCase } from "../../src/features/create-review/CreateReviewUseCase.js";
import { ListMoviesUseCase } from "../../src/features/list-movies/ListMoviesUseCase.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";
import { ValidationError } from "../../src/domain/errors/index.js";
import { NOW, aMovie, aReview, fakeServices, fixedClock } from "../helpers/fakes.js";

const aggregated = (services) => new GetAggregatedDataUseCase({ ...services, clock: fixedClock });

describe("GetAggregatedDataUseCase", () => {
  test("consulta MS1, MS2 e a Function", async () => {
    const services = fakeServices({ reviews: [aReview({ rating: 10 }), aReview({ id: "r2", rating: 8 })] });
    const data = await aggregated(services).execute();
    const names = services.calls.map(([name]) => name);
    assert.deepEqual(names.slice(0, 3).sort(), ["movies.list", "reviews.list", "reviews.stats"]);
    assert.equal(names[3], "insights.calculate");
    assert.equal(data.generatedAt, NOW.toISOString());
    assert.deepEqual(data.sources, { movies: "ok", reviews: "ok", insights: "ok" });
  });

  test("envia à Function a nota dos membros vinda do MS2 (fonte da verdade)", async () => {
    const services = fakeServices({ movies: [aMovie({ membersRating: { average: 1, count: 1 } })], reviews: [aReview({ rating: 10 }), aReview({ id: "r2", rating: 8 })] });
    await aggregated(services).execute();
    const [, sent] = services.calls.find(([name]) => name === "insights.calculate");
    assert.deepEqual(sent[0].membersRating, { average: 9, count: 2 });
  });

  test("Function fora do ar: responde sem insights", async () => {
    const errors = [];
    const services = fakeServices({ fail: { insights: true } });
    const data = await new GetAggregatedDataUseCase({ ...services, clock: fixedClock, logger: { error: (e) => errors.push(e) } }).execute();
    assert.equal(data.sources.insights, "unavailable");
    assert.equal(data.movies[0].insight, null);
    assert.equal(errors.length, 1);
  });

  test("MS2 fora do ar: usa a nota guardada no MS1 e ainda chama a Function", async () => {
    const services = fakeServices({ movies: [aMovie({ membersRating: { average: 7, count: 4 } })], fail: { reviews: true } });
    const data = await aggregated(services).execute();
    assert.equal(data.sources.reviews, "unavailable");
    assert.equal(data.sources.insights, "ok");
    assert.deepEqual(data.movies[0].membersRating, { average: 7, count: 4 });
    assert.deepEqual(data.recentReviews, []);
  });

  test("MS1 fora do ar: a falha sobe (sem catálogo não há agregação)", async () => {
    await assert.rejects(aggregated(fakeServices({ fail: { movies: true } })).execute(), UpstreamError);
  });

  test("exige as quatro portas", () => {
    const { moviesService, reviewsService } = fakeServices();
    assert.throws(() => new GetAggregatedDataUseCase({ moviesService, reviewsService, insightsService: {}, clock: fixedClock }), /InsightsService/);
  });
});

describe("CreateReviewUseCase", () => {
  test("confere o filme no MS1 e grava no MS2", async () => {
    const services = fakeServices();
    const review = await new CreateReviewUseCase(services).execute({ movieId: "m1", author: "Brayan", rating: 7 });
    assert.equal(review.id, "nova");
    assert.deepEqual(services.calls.map(([name]) => name), ["movies.get", "reviews.create"]);
  });

  test("filme inexistente: ValidationError e nada gravado", async () => {
    const services = fakeServices();
    await assert.rejects(new CreateReviewUseCase(services).execute({ movieId: "x", author: "a", rating: 5 }), (error) => error instanceof ValidationError && /não existe/.test(error.message));
    assert.ok(!services.calls.some(([name]) => name === "reviews.create"));
  });

  test("sem movieId: ValidationError sem chamar serviços", async () => {
    const services = fakeServices();
    await assert.rejects(new CreateReviewUseCase(services).execute({ author: "a", rating: 5 }), ValidationError);
    assert.equal(services.calls.length, 0);
  });

  test("MS1 fora do ar: a falha sobe como UpstreamError", async () => {
    await assert.rejects(new CreateReviewUseCase(fakeServices({ fail: { movies: true } })).execute({ movieId: "m1", author: "a", rating: 5 }), UpstreamError);
  });
});

describe("casos de uso de repasse", () => {
  test("ListMovies repassa os filtros", async () => {
    const services = fakeServices();
    await new ListMoviesUseCase(services).execute({ genre: "Drama", search: "cid" });
    assert.deepEqual(services.calls[0], ["movies.list", { genre: "Drama", search: "cid" }]);
  });
});
