import { DomainError } from "./DomainError.js";

/** Recurso de domínio inexistente (ex.: filme com id desconhecido). */
export class NotFoundError extends DomainError {}
