/** API — GET /movies?genre=&search= */
export function listMoviesEndpoint({ useCase }) {
  return {
    method: "get",
    path: "/movies",
    async handler(req, res) {
      res.json(await useCase.execute({ genre: req.query.genre, search: req.query.search }));
    }
  };
}
