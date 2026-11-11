import { readFileSync, writeFileSync } from "node:fs";
import {
  modules,
  normalizeSheet,
  toCubes,
  qualityIssuesFromRows,
} from "../shared/domain.ts";
const snapshots = modules.map((m) => ({
  module: m.id,
  origin: "excel",
  updated_at: new Date().toISOString(),
  cubes: toCubes(
    normalizeSheet(
      m,
      JSON.parse(readFileSync(`.private/${m.id}.json`, "utf8")).values,
    ),
  ),
}));
// Apenas distribuições por data/setor/turno: nunca incluir nomes, e-mails ou texto livre.
writeFileSync(".private/preview-data.json", JSON.stringify(snapshots));
writeFileSync(
  ".private/quality-issues.json",
  JSON.stringify(
    modules.flatMap((m) =>
      qualityIssuesFromRows(
        m,
        normalizeSheet(
          m,
          JSON.parse(readFileSync(`.private/${m.id}.json`, "utf8")).values,
        ),
      ),
    ),
  ),
);
console.log("Prévia agregada gerada sem identificadores ou observações.");
