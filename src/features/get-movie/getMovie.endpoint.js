/** API — GET /movies/:id */
export function getMovieEndpoint({ useCase }) {
  return {
    method: "get",
    path: "/movies/:id",
    async handler(req, res) {
      res.json(await useCase.execute(req.params.id));
    }
  };
}
