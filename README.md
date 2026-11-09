# MovieHub — BFF (Backend for Frontend)

BFF em **Node.js + Express**: único backend que o microfrontend conhece, publicado atrás do **Azure API Management**. Agrega o microsserviço de filmes (MongoDB Atlas), o de avaliações (Azure SQL) e a Azure Function de insights, além de expor o CRUD das duas entidades. Documentação **Swagger** em `/docs`.

## GET /aggregated-data

```
Microfrontend ──▶ API Management ──▶ BFF ──┬─▶ MS Filmes      GET /movies           ┐ em paralelo
                                           ├─▶ MS Avaliações  GET /movie-stats      │
                                           │                  GET /reviews          ┘
                                           └─▶ Azure Function POST /api/insights  (com a nota dos membros já combinada)
```

A resposta junta tudo numa visão pronta para a tela: resumo do catálogo, top 3, médias por gênero, cada filme com score e classificação, e as últimas avaliações com o título do filme. O catálogo é obrigatório (sem ele a resposta é 502); se o microsserviço de avaliações ou a Function falharem, a resposta sai mesmo assim e o campo `sources` indica o que ficou indisponível.

## Endpoints

| Método | Rota | Encaminha para |
|---|---|---|
| GET | `/aggregated-data` | MS Filmes + MS Avaliações + Function |
| GET, POST | `/movies` | MS Filmes |
| GET, PUT, DELETE | `/movies/{id}` | MS Filmes |
| GET, POST | `/reviews` | MS Avaliações (o POST confere antes se o filme existe no MS Filmes) |
| GET, PUT, DELETE | `/reviews/{id}` | MS Avaliações |
| GET | `/health` | Estado do BFF e dos serviços |
| GET | `/docs` | Swagger UI (o mesmo OpenAPI é importado no API Management) |

Erros 400 e 404 dos microsserviços são repassados ao cliente; falha de rede, timeout ou 5xx viram 502.

## Arquitetura

Clean Architecture (Domain, Application, Infrastructure, API) em **Vertical Slices** — uma pasta por funcionalidade.

```
src/
├── domain/               aggregation.js (regras de composição da visão agregada), erros
├── application/          portas MoviesService, ReviewsService, InsightsService, Clock; UpstreamError
├── features/             get-aggregated-data, list/get/create/update/delete-movie, list/get/create/update/delete-review
├── infrastructure/http/  HttpClient (timeout e tradução de erros), HttpMoviesService, HttpReviewsService, HttpInsightsService
├── api/                  createApp (único arquivo com Express), OpenAPI, tratamento de erros
├── container.js          composition root
└── main.js               lê o ambiente e sobe o servidor
infra/
├── docker-compose.yml    ambiente local completo (Mongo, SQL Server, Azurite, 2 microsserviços, Function e BFF)
├── docker-push.sh        build linux/amd64 e push das imagens para o Docker Hub
└── azure/                deploy.sh (Azure CLI) e apim-policy.xml
```

Os testes de arquitetura (ArchUnitTS) verificam a regra da dependência, o isolamento das slices, que só a infraestrutura faz chamadas HTTP, que só o `main.js` lê variáveis de ambiente e que o BFF não acessa banco de dados.

## Tecnologias

Node.js 22, Express 5, swagger-ui-express (OpenAPI 3), fetch nativo com AbortSignal.timeout, node:test, ArchUnitTS, Docker, Azure Container Apps, Azure API Management, GitHub Actions.

## Como executar

```bash
npm install
npm run dev     # http://localhost:3000/docs — espera os serviços nas portas 3001, 3002 e 7071
```

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 3000 | Porta HTTP |
| `MOVIES_SERVICE_URL` | http://localhost:3001 | Microsserviço de filmes |
| `REVIEWS_SERVICE_URL` | http://localhost:3002 | Microsserviço de avaliações |
| `INSIGHTS_FUNCTION_URL` | http://localhost:7071/api/insights | Gatilho HTTP da Function |
| `INSIGHTS_FUNCTION_KEY` | vazio | Chave da função (cabeçalho `x-functions-key`) |
| `UPSTREAM_TIMEOUT_MS` | 8000 | Timeout das chamadas |
| `CORS_ORIGIN` | `*` | Vazio desliga o CORS do BFF (no Azure quem responde é o API Management) |

### Tudo junto com Docker

Com os cinco repositórios clonados lado a lado:

```bash
cd infra
docker compose up --build
```

### Testes

```bash
npm run test:unit   # domínio, casos de uso, cliente HTTP e API (com serviços falsos)
npm run test:arch   # ArchUnitTS
```

### Docker Hub e Azure

```bash
docker build -t <usuario>/moviehub-bff .
docker push <usuario>/moviehub-bff
```

O GitHub Actions publica a imagem a cada push na `main`. O script `infra/azure/deploy.sh` cria no Azure: Storage Account e fila, Azure SQL, ambiente do Container Apps com os dois microsserviços e o BFF (imagens do Docker Hub), Function App, site estático do frontend no Storage e API Management com a política de CORS, limite de requisições e chave de assinatura.

## Repositórios do MovieHub

| Repositório | Papel |
|---|---|
| `moviehub-frontend` | Microfrontend React (shell + MFE Catálogo + MFE Avaliações) |
| `moviehub-bff` | BFF em Node/Express, único ponto de entrada do frontend (atrás do API Management) |
| `moviehub-ms-filmes` | Microsserviço de filmes — MongoDB Atlas |
| `moviehub-ms-avaliacoes` | Microsserviço de avaliações — Azure SQL, publica eventos na fila |
| `moviehub-function` | Azure Function — gatilho HTTP (insights) e gatilho de fila (eventos de avaliação) |

## Grupo

PJBL de Arquitetura de Soluções com Cloud — PUCPR, prof. Manoel Valerio da Silveira Neto.

- Brayan Calisto dos Santos
- Caio Gabriel Silva
- Juliana Flores de Lima
- Leandro de Freitas Pires
