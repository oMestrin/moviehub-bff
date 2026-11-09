import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { RECENT_REVIEWS_LIMIT, buildAggregatedData, recentReviews, withInsights, withMembersRating } from "../../src/domain/aggregation.js";
import { NOW, aMovie, aReview } from "../helpers/fakes.js";

describe("withMembersRating", () => {
  test("usa as estatísticas do MS2 quando disponíveis", () => {
    const [movie] = withMembersRating([aMovie({ membersRating: { average: 5, count: 1 } })], [{ movieId: "m1", average: 9.5, count: 2 }]);
    assert.deepEqual(movie.membersRating, { average: 9.5, count: 2 });
  });

  test("filme sem avaliações no MS2 fica com média nula", () => {
    const [movie] = withMembersRating([aMovie()], []);
    assert.deepEqual(movie.membersRating, { average: null, count: 0 });
  });

  test("sem o MS2, mantém a cópia guardada no MS1", () => {
    const [movie] = withMembersRating([aMovie({ membersRating: { average: 7, count: 3 } })], null);
    assert.deepEqual(movie.membersRating, { average: 7, count: 3 });
  });
});

describe("withInsights", () => {
  test("junta score e classificação por id", () => {
    const [movie] = withInsights([aMovie()], { classifications: [{ movieId: "m1", score: 8.8, label: "Muito bom" }] });
    assert.deepEqual(movie.insight, { score: 8.8, label: "Muito bom" });
  });

  test("sem insights, insight = null", () => {
    assert.equal(withInsights([aMovie()], null)[0].insight, null);
  });
});

describe("recentReviews", () => {
  test("mais recentes primeiro, com o título do filme e limite", () => {
    const reviews = Array.from({ length: 8 }, (_, i) => aReview({ id: `r${i}`, createdAt: `2026-11-0${i + 1}T00:00:00.000Z` }));
    const result = recentReviews(reviews, [aMovie()]);
    assert.equal(result.length, RECENT_REVIEWS_LIMIT);
    assert.equal(result[0].id, "r7");
    assert.equal(result[0].movieTitle, "Interestelar");
  });

  test("filme removido do catálogo: título nulo", () => {
    assert.equal(recentReviews([aReview({ movieId: "x" })], [aMovie()])[0].movieTitle, null);
  });

  test("sem o MS2: lista vazia", () => {
    assert.deepEqual(recentReviews(null, [aMovie()]), []);
  });
});

describe("buildAggregatedData", () => {
  const insights = {
    totalMovies: 1,
    totalReviews: 2,
    averageCriticsRating: 8.6,
    averageMembersRating: 9.5,
    topRated: [{ movieId: "m1", score: 9, label: "Aclamado" }],
    byGenre: [{ genre: "Ficção Científica", movies: 1, averageScore: 9 }],
    classifications: [{ movieId: "m1", score: 9, label: "Aclamado" }]
  };

  test("todas as fontes ok", () => {
    const data = buildAggregatedData({ movies: [aMovie()], stats: [{ movieId: "m1", average: 9.5, count: 2 }], reviews: [aReview()], insights, now: NOW });
    assert.equal(data.generatedAt, NOW.toISOString());
    assert.deepEqual(data.sources, { movies: "ok", reviews: "ok", insights: "ok" });
    assert.deepEqual(data.summary, { totalMovies: 1, totalReviews: 2, averageCriticsRating: 8.6, averageMembersRating: 9.5 });
    assert.deepEqual(data.movies[0].insight, { score: 9, label: "Aclamado" });
    assert.equal(data.recentReviews.length, 1);
  });

  test("sem Function e sem MS2: resposta degradada mas completa", () => {
    const data = buildAggregatedData({ movies: [aMovie()], stats: null, reviews: null, insights: null, now: NOW });
    assert.deepEqual(data.sources, { movies: "ok", reviews: "unavailable", insights: "unavailable" });
    assert.equal(data.summary.totalMovies, 1);
    assert.equal(data.summary.totalReviews, 1);
    assert.deepEqual(data.topRated, []);
    assert.equal(data.movies[0].insight, null);
  });
});
