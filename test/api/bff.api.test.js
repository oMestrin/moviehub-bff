import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../../src/container.js";
import { NOW, fakeServices, fixedClock } from "../helpers/fakes.js";

// sobe o BFF numa porta livre com serviços falsos e testa via HTTP
async function start(options) {
  const services = fakeServices(options);
  const server = buildApp({ ...services, clock: fixedClock }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const response = await fetch(base + path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
  return { server, call, services };
}

describe("BFF — API HTTP", () => {
  let bff;
  before(async () => (bff = await start()));
  after(() => bff.server.close());

  test("GET /aggregated-data", async () => {
    const { status, body } = await bff.call("GET", "/aggregated-data");
    assert.equal(status, 200);
    assert.equal(body.generatedAt, NOW.toISOString());
    assert.deepEqual(body.sources, { movies: "ok", reviews: "ok", insights: "ok" });
    assert.ok(Array.isArray(body.movies) && body.movies[0].insight);
  });

  test("GET /movies repassa filtros", async () => {
    const { status } = await bff.call("GET", "/movies?genre=Drama");
    assert.equal(status, 200);
    assert.deepEqual(bff.services.calls.at(-1), ["movies.list", { genre: "Drama", search: undefined }]);
  });

  test("GET /movies/:id → 200 e 404", async () => {
    assert.equal((await bff.call("GET", "/movies/m1")).status, 200);
    const missing = await bff.call("GET", "/movies/zzz");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "NotFound");
  });

  test("POST /movies → 201 + Location; 400 repassado do MS1", async () => {
    const created = await bff.call("POST", "/movies", { title: "Novo" });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("location"), "/movies/novo");
    assert.equal((await bff.call("POST", "/movies", {})).status, 400);
  });

  test("PUT e DELETE /movies/:id", async () => {
    assert.equal((await bff.call("PUT", "/movies/m1", { title: "Outro" })).body.title, "Outro");
    assert.equal((await bff.call("DELETE", "/movies/m1")).status, 204);
  });

  test("CRUD de /reviews", async () => {
    assert.equal((await bff.call("GET", "/reviews?movieId=m1")).body.length, 1);
    assert.equal((await bff.call("GET", "/reviews/r1")).status, 200);
    assert.equal((await bff.call("POST", "/reviews", { movieId: "m1", author: "Caio", rating: 9 })).status, 201);
    assert.equal((await bff.call("POST", "/reviews", { movieId: "zzz", author: "Caio", rating: 9 })).status, 400);
    assert.equal((await bff.call("PUT", "/reviews/r1", { rating: 7 })).body.rating, 7);
    assert.equal((await bff.call("DELETE", "/reviews/r1")).status, 204);
    assert.equal((await bff.call("DELETE", "/reviews/zzz")).status, 404);
  });

  test("JSON inválido → 400", async () => {
    const response = await fetch(`http://127.0.0.1:${bff.server.address().port}/movies`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
    assert.equal(response.status, 400);
  });

  test("Swagger e OpenAPI", async () => {
    const spec = await bff.call("GET", "/openapi.json");
    assert.equal(spec.body.info.title, "MovieHub — BFF");
    assert.ok(spec.body.paths["/aggregated-data"].get);
    const docs = await fetch(`http://127.0.0.1:${bff.server.address().port}/docs/`);
    assert.equal(docs.status, 200);
  });

  test("CORS para o microfrontend (inclui o cabeçalho do API Management)", async () => {
    const response = await fetch(`http://127.0.0.1:${bff.server.address().port}/movies`, { method: "OPTIONS" });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-headers"), /Ocp-Apim-Subscription-Key/);
  });

  test("CORS desligado quando corsOrigin é vazio (Azure: o APIM responde o CORS)", async () => {
    const services = fakeServices();
    const server = buildApp({ ...services, clock: fixedClock, corsOrigin: "" }).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/movies`);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    server.close();
  });

  test("GET /health informa o estado dos serviços", async () => {
    const { status, body } = await bff.call("GET", "/health");
    assert.equal(status, 200);
    assert.deepEqual(body.checks, { "ms-filmes": "ok", "ms-avaliacoes": "ok" });
  });

  test("rota desconhecida → 404 JSON", async () => {
    assert.equal((await bff.call("GET", "/nada")).status, 404);
  });
});

describe("BFF — serviços fora do ar", () => {
  test("MS1 fora: /aggregated-data e /movies → 502", async () => {
    const bff = await start({ fail: { movies: true } });
    try {
      const response = await bff.call("GET", "/aggregated-data");
      assert.equal(response.status, 502);
      assert.equal(response.body.error, "BadGateway");
      assert.equal((await bff.call("GET", "/movies")).status, 502);
      assert.equal((await bff.call("GET", "/health")).body.checks["ms-filmes"], "unavailable");
    } finally {
      bff.server.close();
    }
  });

  test("Function fora: /aggregated-data → 200 com insights indisponíveis", async () => {
    const bff = await start({ fail: { insights: true } });
    try {
      const { status, body } = await bff.call("GET", "/aggregated-data");
      assert.equal(status, 200);
      assert.equal(body.sources.insights, "unavailable");
    } finally {
      bff.server.close();
    }
  });
});
