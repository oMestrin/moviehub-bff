/** API — PUT /reviews/:id */
export function updateReviewEndpoint({ useCase }) {
  return {
    method: "put",
    path: "/reviews/:id",
    async handler(req, res) {
      res.json(await useCase.execute(req.params.id, req.body ?? {}));
    }
  };
}
