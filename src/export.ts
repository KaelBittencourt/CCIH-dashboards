import {
  evaluated,
  ratio,
  statuses,
  statusLabels,
  sumItems,
  type Cube,
  type Filters,
  type Module,
  type Snapshot,
} from "../shared/domain";
export function csvCell(v: unknown) {
  const value = String(v ?? "");
  return `"${(/^[\s]*[=+@\-]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
}
export function exportCSV(
  module: Module,
  cubes: Cube[],
  filters: Filters,
  snapshot: Snapshot | undefined,
) {
  const rows: unknown[][] = [
    ["Portal CCIH", module.title],
    [
      "Ano",
      filters.year || "Todos",
      "Mês",
      filters.month || "Todos",
      "Setor",
      filters.sector || "Todos",
      "Turno",
      filters.shift || "Todos",
    ],
    [
      "Origem",
      snapshot?.origin ?? "Pendente",
      "Atualização",
      snapshot?.updated_at ?? "Sem sincronização",
    ],
    [
      "Fórmula",
      "Conformes / (conformes + não conformes + parciais) × 100. Pendentes e descritivos sem pontuação.",
    ],
    [
      "Indicador",
      "Elegível para índice",
      "Conformes",
      "Avaliados",
      "Conformidade (%)",
      ...statuses.map((s) => statusLabels[s]),
    ],
    ...module.indicators.map((i) => {
      const c = sumItems(cubes, i.id);
      const d = evaluated(c);
      return [
        i.label,
        i.eligible ? "Sim" : "Não",
        i.mode ? "" : c.conforme,
        i.mode ? "" : d,
        i.mode
          ? ""
          : (ratio(c.conforme, d)?.toFixed(2).replace(".", ",") ??
            "Sem avaliação"),
        ...statuses.map((s) => c[s]),
      ];
    }),
  ];
  const blob = new Blob(
    ["\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ccih-${module.id}-${filters.year || "historico"}-${filters.month || "todos"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
