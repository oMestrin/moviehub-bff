/** API — DELETE /movies/:id */
export function deleteMovieEndpoint({ useCase }) {
  return {
    method: "delete",
    path: "/movies/:id",
    async handler(req, res) {
      await useCase.execute(req.params.id);
      res.status(204).end();
    }
  };
}
