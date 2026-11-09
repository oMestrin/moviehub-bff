import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { HttpClient } from "../../src/infrastructure/http/HttpClient.js";
import { HttpInsightsService } from "../../src/infrastructure/http/HttpInsightsService.js";
import { HttpMoviesService } from "../../src/infrastructure/http/HttpMoviesService.js";
import { HttpReviewsService } from "../../src/infrastructure/http/HttpReviewsService.js";
import { UpstreamError } from "../../src/application/errors/UpstreamError.js";
import { NotFoundError, ValidationError } from "../../src/domain/errors/index.js";

let server;
let baseUrl;
const received = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      const send = (status, payload) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(payload === undefined ? "" : JSON.stringify(payload));
      };
      if (req.url.startsWith("/movies?") || req.url === "/movies") return send(200, [{ id: "m1" }]);
      if (req.url === "/movies/m1" && req.method === "DELETE") return send(204);
      if (req.url === "/movies/m1") return send(200, { id: "m1" });
      if (req.url === "/movies/invalido") return send(400, { error: "ValidationError", message: 'Campo "title" é obrigatório.' });
      if (req.url === "/movies/quebrado") return send(500, { error: "x" });
      if (req.url === "/movies/proibido") return send(401, {});
      if (req.url === "/movie-stats") return send(200, [{ movieId: "m1", average: 9, count: 1 }]);
      if (req.url === "/api/insights") return send(200, { totalMovies: 1 });
      return send(404, { error: "NotFound", message: "Filme x não encontrado." });
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const client = (extra = {}) => new HttpClient({ service: "teste", baseUrl, ...extra });

describe("HttpClient", () => {
  test("GET com query string, ignorando filtros vazios", async () => {
    await new HttpMoviesService(client()).list({ genre: "Drama", search: "" });
    assert.equal(received.at(-1).url, "/movies?genre=Drama");
  });

  test("400 → ValidationError com a mensagem do serviço", async () => {
    await assert.rejects(new HttpMoviesService(client()).get("invalido"), (e) => e instanceof ValidationError && e.message === 'Campo "title" é obrigatório.');
  });

  test("404 → NotFoundError", async () => {
    await assert.rejects(new HttpMoviesService(client()).get("x"), NotFoundError);
  });

  test("5xx e 401 → UpstreamError", async () => {
    await assert.rejects(new HttpMoviesService(client()).get("quebrado"), UpstreamError);
    await assert.rejects(new HttpMoviesService(client()).get("proibido"), UpstreamError);
  });

  test("serviço fora do ar → UpstreamError", async () => {
    await assert.rejects(new HttpMoviesService(new HttpClient({ service: "x", baseUrl: "http://127.0.0.1:1" })).list(), UpstreamError);
  });

  test("timeout → UpstreamError", async () => {
    const slow = createServer(() => {});
    await new Promise((resolve) => slow.listen(0, "127.0.0.1", resolve));
    const c = new HttpClient({ service: "lento", baseUrl: `http://127.0.0.1:${slow.address().port}`, timeoutMs: 50 });
    await assert.rejects(c.get("/qualquer"), UpstreamError);
    slow.closeAllConnections();
    slow.close();
  });

  test("DELETE com 204 sem corpo", async () => {
    assert.equal(await new HttpMoviesService(client()).remove("m1"), undefined);
    assert.equal(received.at(-1).method, "DELETE");
  });
});

describe("clientes dos serviços", () => {
  test("ReviewsService.stats → GET /movie-stats", async () => {
    assert.deepEqual(await new HttpReviewsService(client()).stats(), [{ movieId: "m1", average: 9, count: 1 }]);
  });

  test("InsightsService envia só os campos necessários e a chave da função", async () => {
    const insights = new HttpInsightsService(new HttpClient({ service: "fn", baseUrl: `${baseUrl}/api/insights`, headers: { "x-functions-key": "segredo" } }));
    await insights.calculate([{ id: "m1", title: "T", genre: "G", rating: 8, membersRating: { average: null, count: 0 }, synopsis: "não vai" }]);
    const last = received.at(-1);
    assert.equal(last.method, "POST");
    assert.equal(last.url, "/api/insights");
    assert.equal(last.headers["x-functions-key"], "segredo");
    assert.deepEqual(last.body, { movies: [{ id: "m1", title: "T", genre: "G", rating: 8, membersRating: { average: null, count: 0 } }] });
  });
});
