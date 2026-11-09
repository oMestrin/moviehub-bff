/**
 * API — documentação OpenAPI 3.0 do BFF (servida em /docs e /openapi.json).
 * É também o contrato importado no Azure API Management.
 */
const json = (schema) => ({ "application/json": { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const error = (description) => ({ description, content: json(ref("Error")) });
const idParam = (description) => ({ name: "id", in: "path", required: true, schema: { type: "string" }, description });
const badGateway = error("Serviço de trás indisponível");

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "MovieHub — BFF",
    version: "1.0.0",
    description:
      "Backend for Frontend do MovieHub. É o único ponto de entrada do microfrontend (atrás do Azure API Management). " +
      "Agrega o microsserviço de filmes (MongoDB Atlas), o de avaliações (Azure SQL) e a Azure Function de insights. " +
      "Organizado em Clean Architecture + Vertical Slice."
  },
  tags: [{ name: "Agregação" }, { name: "Filmes" }, { name: "Avaliações" }, { name: "Saúde" }],
  paths: {
    "/aggregated-data": {
      get: {
        tags: ["Agregação"],
        operationId: "getAggregatedData",
        summary: "Visão agregada do catálogo",
        description:
          "Busca em paralelo os filmes (MS1) e as estatísticas e avaliações (MS2); depois envia os filmes à Azure Function, " +
          "que devolve score, classificação, ranking e médias por gênero. Se o MS2 ou a Function falharem, a resposta sai com " +
          "a fonte marcada como `unavailable` em `sources`.",
        responses: { 200: { description: "Dados agregados", content: json(ref("AggregatedData")) }, 502: badGateway }
      }
    },
    "/movies": {
      get: {
        tags: ["Filmes"],
        operationId: "listMovies",
        summary: "Lista filmes",
        parameters: [
          { name: "genre", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Busca no título" }
        ],
        responses: { 200: { description: "Filmes", content: json({ type: "array", items: ref("Movie") }) }, 502: badGateway }
      },
      post: {
        tags: ["Filmes"],
        operationId: "createMovie",
        summary: "Cadastra um filme",
        requestBody: { required: true, content: json(ref("MovieInput")) },
        responses: { 201: { description: "Criado", content: json(ref("Movie")) }, 400: error("Dados inválidos"), 502: badGateway }
      }
    },
    "/movies/{id}": {
      get: {
        tags: ["Filmes"],
        operationId: "getMovie",
        summary: "Busca um filme",
        parameters: [idParam("Id do filme")],
        responses: { 200: { description: "Filme", content: json(ref("Movie")) }, 404: error("Não encontrado"), 502: badGateway }
      },
      put: {
        tags: ["Filmes"],
        operationId: "updateMovie",
        summary: "Altera um filme",
        parameters: [idParam("Id do filme")],
        requestBody: { required: true, content: json(ref("MovieInput")) },
        responses: { 200: { description: "Alterado", content: json(ref("Movie")) }, 400: error("Dados inválidos"), 404: error("Não encontrado"), 502: badGateway }
      },
      delete: {
        tags: ["Filmes"],
        operationId: "deleteMovie",
        summary: "Remove um filme",
        parameters: [idParam("Id do filme")],
        responses: { 204: { description: "Removido" }, 404: error("Não encontrado"), 502: badGateway }
      }
    },
    "/reviews": {
      get: {
        tags: ["Avaliações"],
        operationId: "listReviews",
        summary: "Lista avaliações (mais recentes primeiro)",
        parameters: [{ name: "movieId", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Avaliações", content: json({ type: "array", items: ref("Review") }) }, 502: badGateway }
      },
      post: {
        tags: ["Avaliações"],
        operationId: "createReview",
        summary: "Registra uma avaliação",
        description: "O BFF confere no MS1 se o filme existe antes de gravar no MS2. O MS2 publica o evento `moviehub.avaliacao.registrada`.",
        requestBody: { required: true, content: json(ref("ReviewInput")) },
        responses: { 201: { description: "Criada", content: json(ref("Review")) }, 400: error("Dados inválidos ou filme inexistente"), 502: badGateway }
      }
    },
    "/reviews/{id}": {
      get: {
        tags: ["Avaliações"],
        operationId: "getReview",
        summary: "Busca uma avaliação",
        parameters: [idParam("Id da avaliação")],
        responses: { 200: { description: "Avaliação", content: json(ref("Review")) }, 404: error("Não encontrada"), 502: badGateway }
      },
      put: {
        tags: ["Avaliações"],
        operationId: "updateReview",
        summary: "Altera nota e comentário",
        parameters: [idParam("Id da avaliação")],
        requestBody: { required: true, content: json(ref("ReviewUpdate")) },
        responses: { 200: { description: "Alterada", content: json(ref("Review")) }, 400: error("Dados inválidos"), 404: error("Não encontrada"), 502: badGateway }
      },
      delete: {
        tags: ["Avaliações"],
        operationId: "deleteReview",
        summary: "Remove uma avaliação",
        parameters: [idParam("Id da avaliação")],
        responses: { 204: { description: "Removida" }, 404: error("Não encontrada"), 502: badGateway }
      }
    },
    "/health": {
      get: { tags: ["Saúde"], operationId: "health", summary: "Estado do BFF e dos serviços de trás", responses: { 200: { description: "BFF no ar" } } }
    }
  },
  components: {
    schemas: {
      MovieInput: {
        type: "object",
        required: ["title", "releaseYear", "genre", "director", "rating", "synopsis"],
        properties: {
          title: { type: "string", example: "Interestelar" },
          releaseYear: { type: "integer", example: 2014 },
          genre: { type: "string", example: "Ficção Científica" },
          director: { type: "string", example: "Christopher Nolan" },
          rating: { type: "number", minimum: 0, maximum: 10, description: "Nota da crítica", example: 8.6 },
          synopsis: { type: "string", example: "Exploradores atravessam um buraco de minhoca..." },
          posterUrl: { type: "string", format: "uri", nullable: true }
        }
      },
      Movie: {
        allOf: [
          ref("MovieInput"),
          {
            type: "object",
            properties: {
              id: { type: "string" },
              membersRating: ref("MembersRating"),
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      MembersRating: {
        type: "object",
        properties: { average: { type: "number", nullable: true, example: 9.5 }, count: { type: "integer", example: 2 } }
      },
      ReviewInput: {
        type: "object",
        required: ["movieId", "author", "rating"],
        properties: {
          movieId: { type: "string", example: "4f3c2a1e-0001-4b8e-9f00-000000000001" },
          author: { type: "string", example: "Juliana" },
          rating: { type: "integer", minimum: 0, maximum: 10, example: 9 },
          comment: { type: "string", nullable: true, example: "Trilha sonora incrível." }
        }
      },
      ReviewUpdate: {
        type: "object",
        required: ["rating"],
        properties: { rating: { type: "integer", minimum: 0, maximum: 10 }, comment: { type: "string", nullable: true } }
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "string" },
          movieId: { type: "string" },
          author: { type: "string" },
          rating: { type: "integer" },
          comment: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      Classification: {
        type: "object",
        properties: {
          movieId: { type: "string" },
          title: { type: "string" },
          genre: { type: "string" },
          score: { type: "number", example: 9 },
          label: { type: "string", enum: ["Aclamado", "Muito bom", "Bom", "Mediano", "Fraco"] }
        }
      },
      AggregatedData: {
        type: "object",
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          sources: {
            type: "object",
            description: "Estado de cada fonte consultada",
            properties: {
              movies: { type: "string", enum: ["ok"] },
              reviews: { type: "string", enum: ["ok", "unavailable"] },
              insights: { type: "string", enum: ["ok", "unavailable"] }
            }
          },
          summary: {
            type: "object",
            properties: {
              totalMovies: { type: "integer" },
              totalReviews: { type: "integer" },
              averageCriticsRating: { type: "number", nullable: true },
              averageMembersRating: { type: "number", nullable: true }
            }
          },
          topRated: { type: "array", items: ref("Classification") },
          byGenre: {
            type: "array",
            items: { type: "object", properties: { genre: { type: "string" }, movies: { type: "integer" }, averageScore: { type: "number" } } }
          },
          movies: {
            type: "array",
            items: {
              allOf: [
                ref("Movie"),
                { type: "object", properties: { insight: { type: "object", nullable: true, properties: { score: { type: "number" }, label: { type: "string" } } } } }
              ]
            }
          },
          recentReviews: {
            type: "array",
            items: { allOf: [ref("Review"), { type: "object", properties: { movieTitle: { type: "string", nullable: true } } }] }
          }
        }
      },
      Error: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } }
    }
  }
};
