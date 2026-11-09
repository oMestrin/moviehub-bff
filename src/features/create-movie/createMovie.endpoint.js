/** API — POST /movies */
export function createMovieEndpoint({ useCase }) {
  return {
    method: "post",
    path: "/movies",
    async handler(req, res) {
      const movie = await useCase.execute(req.body ?? {});
      res.status(201).location(`/movies/${movie.id}`).json(movie);
    }
  };
}
