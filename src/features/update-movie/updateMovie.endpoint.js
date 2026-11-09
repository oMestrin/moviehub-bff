/** API — PUT /movies/:id */
export function updateMovieEndpoint({ useCase }) {
  return {
    method: "put",
    path: "/movies/:id",
    async handler(req, res) {
      res.json(await useCase.execute(req.params.id, req.body ?? {}));
    }
  };
}
