/**
 * Domínio do BFF — regras de composição da visão agregada (funções puras).
 *
 * O BFF junta três fontes:
 *  - catálogo (MS1, MongoDB): dados do filme e uma cópia da nota dos membros;
 *  - avaliações (MS2, Azure SQL): fonte da verdade das notas dos membros;
 *  - insights (Azure Function): score e classificação de cada filme.
 */

export const RECENT_REVIEWS_LIMIT = 5;

/**
 * Usa as estatísticas do MS2 (fonte da verdade) quando disponíveis; senão,
 * mantém a cópia que o MS1 guarda (atualizada pelos eventos).
 */
export function withMembersRating(movies, stats) {
  if (!stats) {
    return movies.map((movie) => ({ ...movie, membersRating: movie.membersRating ?? { average: null, count: 0 } }));
  }
  const byMovie = new Map(stats.map((s) => [s.movieId, s]));
  return movies.map((movie) => {
    const s = byMovie.get(movie.id);
    return { ...movie, membersRating: s ? { average: s.average, count: s.count } : { average: null, count: 0 } };
  });
}

/** Junta score e classificação calculados pela Function em cada filme. */
export function withInsights(movies, insights) {
  const byMovie = new Map((insights?.classifications ?? []).map((c) => [c.movieId, c]));
  return movies.map((movie) => {
    const c = byMovie.get(movie.id);
    return { ...movie, insight: c ? { score: c.score, label: c.label } : null };
  });
}

/** Avaliações mais recentes, com o título do filme ao lado. */
export function recentReviews(reviews, movies, limit = RECENT_REVIEWS_LIMIT) {
  if (!reviews) {
    return [];
  }
  const titles = new Map(movies.map((m) => [m.id, m.title]));
  return [...reviews]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((review) => ({ ...review, movieTitle: titles.get(review.movieId) ?? null }));
}

export function buildAggregatedData({ movies, stats, reviews, insights, now }) {
  const rated = withMembersRating(movies, stats);
  return {
    generatedAt: now.toISOString(),
    sources: {
      movies: "ok",
      reviews: stats ? "ok" : "unavailable",
      insights: insights ? "ok" : "unavailable"
    },
    summary: insights
      ? {
          totalMovies: insights.totalMovies,
          totalReviews: insights.totalReviews,
          averageCriticsRating: insights.averageCriticsRating,
          averageMembersRating: insights.averageMembersRating
        }
      : { totalMovies: rated.length, totalReviews: rated.reduce((n, m) => n + (m.membersRating?.count ?? 0), 0), averageCriticsRating: null, averageMembersRating: null },
    topRated: insights?.topRated ?? [],
    byGenre: insights?.byGenre ?? [],
    movies: withInsights(rated, insights),
    recentReviews: recentReviews(reviews, movies)
  };
}
