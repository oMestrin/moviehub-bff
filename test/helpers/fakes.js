import { NotFoundError, ValidationError } from "../../src/domain/errors/index.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";

export const NOW = new Date("2026-11-08T12:00:00.000Z");
export const fixedClock = { now: () => NOW };

export const aMovie = (overrides = {}) => ({
  id: "m1",
  title: "Interestelar",
  releaseYear: 2014,
  genre: "Ficção Científica",
  director: "Christopher Nolan",
  rating: 8.6,
  synopsis: "...",
  posterUrl: null,
  membersRating: { average: 9, count: 1 },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

export const aReview = (overrides = {}) => ({
  id: "r1",
  movieId: "m1",
  author: "Leandro",
  rating: 9,
  comment: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...overrides
});

/** Serviços falsos em memória; `fail` derruba um serviço inteiro. */
export function fakeServices({ movies = [aMovie()], reviews = [aReview()], fail = {} } = {}) {
  const calls = [];
  const down = (name) => {
    if (fail[name]) throw new UpstreamError(name, "fora do ar");
  };
  const moviesService = {
    async list(filter) {
      calls.push(["movies.list", filter]);
      down("movies");
      return movies;
    },
    async get(id) {
      calls.push(["movies.get", id]);
      down("movies");
      const movie = movies.find((m) => m.id === id);
      if (!movie) throw new NotFoundError(`Filme ${id} não encontrado.`);
      return movie;
    },
    async create(input) {
      calls.push(["movies.create", input]);
      if (!input.title) throw new ValidationError('Campo "title" é obrigatório.');
      return { ...aMovie(), ...input, id: "novo" };
    },
    async update(id, input) {
      calls.push(["movies.update", id, input]);
      return { ...(await this.get(id)), ...input };
    },
    async remove(id) {
      calls.push(["movies.remove", id]);
      await this.get(id);
    },
    async health() {
      down("movies");
      return { status: "ok" };
    }
  };
  const reviewsService = {
    async list(filter) {
      calls.push(["reviews.list", filter]);
      down("reviews");
      return filter?.movieId ? reviews.filter((r) => r.movieId === filter.movieId) : reviews;
    },
    async get(id) {
      calls.push(["reviews.get", id]);
      const review = reviews.find((r) => r.id === id);
      if (!review) throw new NotFoundError(`Avaliação ${id} não encontrada.`);
      return review;
    },
    async create(input) {
      calls.push(["reviews.create", input]);
      down("reviews");
      return { ...aReview(), ...input, id: "nova" };
    },
    async update(id, input) {
      calls.push(["reviews.update", id, input]);
      return { ...(await this.get(id)), ...input };
    },
    async remove(id) {
      calls.push(["reviews.remove", id]);
      await this.get(id);
    },
    async stats() {
      calls.push(["reviews.stats"]);
      down("reviews");
      const byMovie = new Map();
      for (const r of reviews) byMovie.set(r.movieId, [...(byMovie.get(r.movieId) ?? []), r.rating]);
      return [...byMovie].map(([movieId, rs]) => ({ movieId, average: rs.reduce((a, b) => a + b, 0) / rs.length, count: rs.length }));
    },
    async health() {
      down("reviews");
      return { status: "ok" };
    }
  };
  const insightsService = {
    async calculate(list) {
      calls.push(["insights.calculate", list]);
      down("insights");
      const classifications = list.map((m) => ({ movieId: m.id, title: m.title, genre: m.genre, score: m.rating, label: "Muito bom" }));
      return {
        totalMovies: list.length,
        totalReviews: list.reduce((n, m) => n + m.membersRating.count, 0),
        averageCriticsRating: 8.6,
        averageMembersRating: 9,
        topRated: classifications.slice(0, 3),
        byGenre: [{ genre: "Ficção Científica", movies: list.length, averageScore: 8.6 }],
        classifications
      };
    }
  };
  return { calls, moviesService, reviewsService, insightsService };
}
