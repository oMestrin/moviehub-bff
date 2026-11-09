/** API — POST /reviews */
export function createReviewEndpoint({ useCase }) {
  return {
    method: "post",
    path: "/reviews",
    async handler(req, res) {
      const review = await useCase.execute(req.body ?? {});
      res.status(201).location(`/reviews/${review.id}`).json(review);
    }
  };
}
