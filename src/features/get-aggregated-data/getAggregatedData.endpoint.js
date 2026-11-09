/** API — GET /aggregated-data */
export function getAggregatedDataEndpoint({ useCase }) {
  return {
    method: "get",
    path: "/aggregated-data",
    async handler(req, res) {
      res.json(await useCase.execute());
    }
  };
}
