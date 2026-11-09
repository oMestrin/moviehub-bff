import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// o ArchUnitTS precisa do tsconfig para ler os imports
export const TSCONFIG = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));

// roda a regra e mostra as violações se tiver alguma
export async function expectNoViolations(rule) {
  const violations = await rule.check();
  assert.equal(
    violations.length,
    0,
    `Violações de arquitetura (${violations.length}):\n` +
      violations.map((violation) => `  - ${describeViolation(violation)}`).join("\n")
  );
}

// lista as pastas de features (uma por slice)
export function listSlices(featuresDir) {
  const url = new URL(`../../${featuresDir}/`, import.meta.url);
  return readdirSync(url, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function describeViolation(violation) {
  if (violation.dependency) {
    return `${violation.dependency.sourceLabel} -> ${violation.dependency.targetLabel}`;
  }
  if (violation.cycle) {
    return `ciclo: ${violation.cycle.map((edge) => edge.sourceLabel).join(" -> ")}`;
  }
  if (violation.projectedNode) {
    return `${violation.projectedNode.label} (padrão esperado: ${violation.checkPattern})`;
  }
  if (violation.fileInfo) {
    return `${violation.fileInfo.path}: ${violation.message}`;
  }
  return violation.message ?? JSON.stringify(violation);
}
