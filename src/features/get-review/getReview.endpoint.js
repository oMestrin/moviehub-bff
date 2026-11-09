/** API — GET /reviews/:id */
export function getReviewEndpoint({ useCase }) {
  return {
    method: "get",
    path: "/reviews/:id",
    async handler(req, res) {
      res.json(await useCase.execute(req.params.id));
    }
  };
}
