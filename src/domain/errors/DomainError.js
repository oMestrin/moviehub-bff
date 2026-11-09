/**
 * Erro base de domínio. Camada mais interna: não conhece HTTP.
 * Quem traduz para status HTTP é o errorHandler da camada API.
 */
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}
