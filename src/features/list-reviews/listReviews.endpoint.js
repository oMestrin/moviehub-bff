/** API — GET /reviews?movieId= */
export function listReviewsEndpoint({ useCase }) {
  return {
    method: "get",
    path: "/reviews",
    async handler(req, res) {
      res.json(await useCase.execute({ movieId: req.query.movieId }));
    }
  };
}
