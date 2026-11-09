/**
 * Shared Kernel — contrato de interface (porta) em JavaScript.
 *
 * JavaScript não tem `interface` nativa. Este helper cria um contrato
 * explícito (nome + métodos obrigatórios) que os casos de uso usam para
 * validar, na composição, que a dependência injetada cumpre a porta
 * (fail-fast). É o que permite aplicar a Regra da Dependência da Clean
 * Architecture: o caso de uso depende da porta, nunca da implementação.
 *
 * @param {string} name      Nome da porta (ex.: "MovieListReader").
 * @param {string[]} methods Métodos que toda implementação deve expor.
 */
export function defineInterface(name, methods) {
  const contract = Object.freeze([...methods]);

  return Object.freeze({
    name,
    methods: contract,

    /** true se `candidate` implementa todos os métodos do contrato. */
    isImplementedBy(candidate) {
      return (
        candidate != null &&
        contract.every((method) => typeof candidate[method] === "function")
      );
    },

    /** Lança TypeError se `candidate` não cumprir o contrato; senão o devolve. */
    ensure(candidate) {
      if (!this.isImplementedBy(candidate)) {
        const missing = contract.filter(
          (method) => typeof candidate?.[method] !== "function"
        );
        throw new TypeError(
          `Dependência inválida: esperado ${name} (faltando: ${missing.join(", ")}).`
        );
      }
      return candidate;
    }
  });
}
