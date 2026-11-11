export type ModuleId = "cateter" | "bloqueio";
export type Status =
  | "conforme"
  | "nao_conforme"
  | "parcial"
  | "nao_avaliado"
  | "nao_visualizado"
  | "vazio"
  | "descritivo";
export type Counts = Record<Status, number>;
export type Indicator = {
  id: string;
  label: string;
  header: string;
  eligible: boolean;
  mode?: "description" | "pending";
  note?: string;
};
export type Module = {
  id: ModuleId;
  title: string;
  subtitle: string;
  sheetId: string;
  dateHeader: string;
  responsibleHeader: string;
  indicators: Indicator[];
};
export const modules: Module[] = [
  {
    id: "cateter",
    title: "Cateter vesical",
    subtitle: "Práticas de manutenção e segurança do CVD",
    sheetId: "1TepvxI4u1g66PuvwMQjb_2GZCW7jgW3fHI6qtyzBxGA",
    dateHeader: "Data da auditoria",
    responsibleHeader: "Responsável pela unidade no momento da auditoria",
    indicators: [
      {
        id: "posicao",
        label: "Bolsa abaixo da bexiga",
        header: "Bolsa de drenagem abaixo do nivel da bexiga",
        eligible: true,
      },
      {
        id: "fluxo",
        label: "Fluxo urinário livre",
        header: "Fluxo de Urina livre",
        eligible: true,
      },
      {
        id: "volume",
        label: "Volume da bolsa (2/3)",
        header: "Diurese ocupando 2/3 da bolsa de drenagem",
        eligible: false,
        mode: "pending",
        note: "A interpretação de “Sim” depende da validação da CCIH.",
      },
      {
        id: "suspensa",
        label: "Bolsa sem contato com o chão",
        header: "Bolsa de drenagem suspensa (não tocando o chão)",
        eligible: true,
      },
      {
        id: "fixacao",
        label: "Presença de fixação",
        header: "Com fixação",
        eligible: false,
        note: "Indicador individual. O índice utiliza apenas fixação adequada para evitar peso duplicado.",
      },
      {
        id: "fixacao_adequada",
        label: "Fixação adequada",
        header: "Com fixação adequada",
        eligible: true,
      },
      {
        id: "higiene",
        label: "Higiene diária do meato",
        header: "Higiene diária do meato urinário",
        eligible: false,
      },
      {
        id: "motivo",
        label: "Conhecimento do motivo de permanência",
        header: "Enfermeiro sabe motivo da permanência do CVD?",
        eligible: false,
      },
      {
        id: "indicacao",
        label: "Indicação de permanência registrada",
        header: "Existe indicação para permanência",
        eligible: false,
        note: "Resposta registrada; não representa validação clínica independente.",
      },
      {
        id: "instalacao",
        label: "Instalação de SVD observada",
        header: "Em visualização de instalação de SVD",
        eligible: false,
        mode: "description",
        note: "Registro descritivo, sem atribuição automática de adequação.",
      },
      {
        id: "identificacao",
        label: "Identificação da bolsa",
        header: "Possui Identificação na bolsas",
        eligible: true,
      },
    ],
  },
  {
    id: "bloqueio",
    title: "Medidas de bloqueio",
    subtitle: "Isolamento, sinalização e paramentação",
    sheetId: "1VaQ4hf1GFm8fow3gSULHTem9CwIphgbPpgQDWGVe8js",
    dateHeader: "Data da auditoria",
    responsibleHeader: "Responsável pela unidade",
    indicators: [
      {
        id: "placa",
        label: "Placa indicativa no quarto",
        header: "Placa indicativa no quarto?",
        eligible: true,
      },
      {
        id: "adesivo",
        label: "Adesivo na pasta",
        header: "Adesivo indicativo na pasta do paciente",
        eligible: true,
      },
      {
        id: "conhecimento",
        label: "Conhecimento dos isolamentos",
        header:
          "O Enfermeiro tem conhecimento de quantos e quais isolamentos existem na unidade",
        eligible: true,
      },
      {
        id: "epc",
        label: "Profissional exclusivo para EPC",
        header: "Existe profissional exclusivo para paciente com EPC",
        eligible: false,
        mode: "pending",
        note: "Obrigatoriedade e aplicabilidade pendentes de validação da CCIH.",
      },
      {
        id: "disponiveis",
        label: "Estações de isolamento disponíveis",
        header: "Estações de isolamento/bancadas disponíveis",
        eligible: true,
      },
      {
        id: "adequadas",
        label: "Estações em condições adequadas",
        header: "Estações de isolamento/bancadas em condições adequadas",
        eligible: true,
      },
      {
        id: "colocacao",
        label: "Colocação da paramentação",
        header: "Passo a passo da colocação da paramentação adequados",
        eligible: true,
      },
      {
        id: "retirada",
        label: "Retirada da paramentação",
        header: "Passo a passo da retirada da paramentação adequados",
        eligible: true,
      },
      {
        id: "comum",
        label: "Lixeira comum com pedal",
        header:
          "Lixeira para resíduos comum com acionamento por pedal, disponível e funcionando?",
        eligible: true,
      },
      {
        id: "reciclavel",
        label: "Lixeira reciclável com pedal",
        header:
          "Lixeira para resíduos reciclavel com acionamento por pedal, disponível e funcionando?",
        eligible: false,
        mode: "pending",
        note: "Obrigatoriedade e aplicabilidade pendentes de validação da CCIH.",
      },
    ],
  },
];
export const statuses: Status[] = [
  "conforme",
  "nao_conforme",
  "parcial",
  "nao_avaliado",
  "nao_visualizado",
  "vazio",
  "descritivo",
];
export const statusLabels: Record<Status, string> = {
  conforme: "Conforme",
  nao_conforme: "Não conforme",
  parcial: "Parcialmente conforme",
  nao_avaliado: "Não avaliado",
  nao_visualizado: "Não visualizado",
  vazio: "Em branco",
  descritivo: "Descritivo",
};
export const emptyCounts = (): Counts =>
  Object.fromEntries(statuses.map((s) => [s, 0])) as Counts;
export function key(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^\d+\s*[.):-]?\s*/, "")
    .replace(/\s+/g, " ");
}
export function classify(value: unknown, indicator: Indicator): Status {
  const v = key(value);
  if (!v) return "vazio";
  if (v === "nao avaliado") return "nao_avaliado";
  if (v === "nao visualizado") return "nao_visualizado";
  if (indicator.mode === "description") return "descritivo";
  if (v === "sim" || v === "conforme") return "conforme";
  if (v === "nao" || v === "nao conforme") return "nao_conforme";
  if (v === "parcialmente" || v === "parcialmente conforme") return "parcial";
  throw new Error(
    `Resposta não reconhecida em ${indicator.label}: ${String(value)}`,
  );
}
export function parseDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100
      ? d.toISOString().slice(0, 10)
      : null;
  }
  const v = String(value ?? "").trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(v);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/.exec(v);
  if (iso) {
    [, y, m, d] = iso.map(Number);
  } else if (br) {
    d = +br[1];
    m = +br[2];
    y = +br[3];
  } else return null;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : null;
}
export type NormalizedRow = {
  source_row: number;
  audit_date: string | null;
  submitted_at: string;
  sector: string;
  shift: string;
  responsible: string;
  email: string;
  observations: string;
  date_issue: string | null;
  answers: Record<string, Status>;
  original: Record<string, unknown>;
};
export function normalizeSheet(
  module: Module,
  values: unknown[][],
): NormalizedRow[] {
  if (!values.length)
    throw new Error("Planilha sem cabeçalhos. A última base foi preservada.");
  const headers = values[0].map(String);
  const normalized = headers.map(key);
  if (new Set(normalized).size !== normalized.length)
    throw new Error("Cabeçalhos duplicados após normalização.");
  const required = [
    "Carimbo de data/hora",
    module.dateHeader,
    "Setor Auditado",
    "Turno:",
    module.responsibleHeader,
    ...module.indicators.map((i) => i.header),
  ];
  for (const h of required)
    if (!normalized.includes(key(h)))
      throw new Error(
        `Coluna obrigatória ausente: ${h}. A última base foi preservada.`,
      );
  const get = (row: unknown[], h: string) =>
    row[normalized.indexOf(key(h))] ?? "";
  return values.slice(1).flatMap((row, index) => {
    if (row.every((v) => v == null || String(v).trim() === "")) return [];
    const date = parseDate(get(row, module.dateHeader));
    const submittedValue = get(row, "Carimbo de data/hora");
    const submittedDate = parseDate(submittedValue);
    const submitted =
      typeof submittedValue === "number" && submittedDate
        ? new Date(Date.UTC(1899, 11, 30) + submittedValue * 86400000)
            .toISOString()
            .replace("Z", "")
        : String(submittedValue);
    if (!submittedDate)
      throw new Error(`Carimbo inválido na linha ${index + 2}.`);
    const delta = date
      ? Math.abs(Date.parse(submittedDate) - Date.parse(date)) / 86400000
      : 0;
    const answers = Object.fromEntries(
      module.indicators.map((i) => [i.id, classify(get(row, i.header), i)]),
    );
    return [
      {
        source_row: index + 2,
        audit_date: date,
        submitted_at: submitted,
        sector: String(get(row, "Setor Auditado")).trim(),
        shift: String(get(row, "Turno:")).trim(),
        responsible: String(get(row, module.responsibleHeader)).trim(),
        email: String(get(row, "Endereço de e-mail")).trim(),
        observations: String(get(row, "Observações")),
        date_issue: !date
          ? "Data da auditoria inválida"
          : delta > 30
            ? "Divergência superior a 30 dias entre auditoria e envio"
            : null,
        answers,
        original: Object.fromEntries(
          headers.map((h, i) => [h, row[i] ?? null]),
        ),
      },
    ];
  });
}
export type Cube = {
  date: string | null;
  sector: string;
  shift: string;
  total: number;
  invalid: number;
  discrepancy: number;
  items: Record<string, Counts>;
};
export type Snapshot = {
  module: ModuleId;
  origin: "excel" | "google" | null;
  updated_at: string | null;
  cubes: Cube[];
  error?: string | null;
  attempted_at?: string | null;
};
export function toCubes(rows: NormalizedRow[]): Cube[] {
  const map = new Map<string, Cube>();
  for (const row of rows) {
    const k = JSON.stringify([row.audit_date, row.sector, row.shift]);
    const cube = map.get(k) ?? {
      date: row.audit_date,
      sector: row.sector,
      shift: row.shift,
      total: 0,
      invalid: 0,
      discrepancy: 0,
      items: {},
    };
    cube.total++;
    if (!row.audit_date) cube.invalid++;
    else if (row.date_issue) cube.discrepancy++;
    for (const [id, status] of Object.entries(row.answers)) {
      cube.items[id] ??= emptyCounts();
      cube.items[id][status]++;
    }
    map.set(k, cube);
  }
  return [...map.values()];
}
export type Filters = {
  year: string;
  month: string;
  sector: string;
  shift: string;
};
export const initialFilters: Filters = {
  year: "",
  month: "",
  sector: "",
  shift: "",
};
export function filterCubes(cubes: Cube[], filters: Filters): Cube[] {
  return cubes.filter(
    (c) =>
      (!filters.year || c.date?.slice(0, 4) === filters.year) &&
      (!filters.month || c.date?.slice(5, 7) === filters.month) &&
      (!filters.sector || c.sector === filters.sector) &&
      (!filters.shift || c.shift === filters.shift),
  );
}
export function sumItems(cubes: Cube[], id: string): Counts {
  const total = emptyCounts();
  for (const c of cubes)
    for (const s of statuses) total[s] += c.items[id]?.[s] ?? 0;
  return total;
}
export function evaluated(c: Counts) {
  return c.conforme + c.nao_conforme + c.parcial;
}
export function ratio(n: number, d: number) {
  return d ? (n / d) * 100 : null;
}
export function summary(module: Module, cubes: Cube[]) {
  const counts = module.indicators
    .filter((i) => i.eligible)
    .map((i) => sumItems(cubes, i.id));
  const total = cubes.reduce((s, c) => s + c.total, 0);
  const numerator = counts.reduce((s, c) => s + c.conforme, 0);
  const denominator = counts.reduce((s, c) => s + evaluated(c), 0);
  return {
    total,
    numerator,
    denominator,
    percent: ratio(numerator, denominator),
    coverage: ratio(denominator, total * counts.length),
    opportunities: total * counts.length,
    invalid: cubes.reduce((s, c) => s + c.invalid, 0),
    discrepancy: cubes.reduce((s, c) => s + c.discrepancy, 0),
  };
}
export function monthly(module: Module, cubes: Cube[], year = "") {
  const dates = cubes
    .flatMap((c) => (c.date ? [c.date.slice(0, 7)] : []))
    .sort();
  if (!dates.length && !year) return [];
  const start = year ? `${year}-01` : dates[0],
    end = year ? `${year}-12` : dates.at(-1)!;
  const result = [];
  let [y, m] = start.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= end) {
    const period = `${y}-${String(m).padStart(2, "0")}`;
    result.push({
      period,
      label: new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      ...summary(
        module,
        cubes.filter((c) => c.date?.startsWith(period)),
      ),
    });
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}
export function previousMonth(year: string, month: string) {
  const d = new Date(Date.UTC(+year, +month - 2, 1));
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, "0"),
  };
}

export type QualityIssue = {
  module: ModuleId;
  source_row: number;
  audit_date: string | null;
  sector: string;
  shift: string;
  field_key: string;
  raw_value: string;
  reference_date: string;
  issue_type: "invalid_date" | "date_discrepancy" | "blank_answer";
};
export type QualityIssuePage = { total: number; items: QualityIssue[] };
export function qualityIssuesFromRows(
  module: Module,
  rows: NormalizedRow[],
): QualityIssue[] {
  return rows.flatMap((row) => {
    const base = {
      module: module.id,
      source_row: row.source_row,
      audit_date: row.audit_date,
      sector: row.sector,
      shift: row.shift,
      reference_date: row.submitted_at.slice(0, 10),
    };
    const issues: QualityIssue[] = [];
    if (row.date_issue) {
      const raw = Object.entries(row.original).find(
        ([header]) => key(header) === key(module.dateHeader),
      )?.[1];
      issues.push({
        ...base,
        field_key: "audit_date",
        raw_value: String(raw ?? "").slice(0, 80),
        issue_type: row.audit_date ? "date_discrepancy" : "invalid_date",
      });
    }
    for (const [field_key, status] of Object.entries(row.answers)) {
      if (status === "vazio")
        issues.push({
          ...base,
          field_key,
          raw_value: "",
          issue_type: "blank_answer",
        });
    }
    return issues;
  });
}
export function filterQualityIssues(
  issues: QualityIssue[],
  filters: Filters,
): QualityIssue[] {
  return issues.filter(
    (i) =>
      (!filters.year || i.audit_date?.slice(0, 4) === filters.year) &&
      (!filters.month || i.audit_date?.slice(5, 7) === filters.month) &&
      (!filters.sector || i.sector === filters.sector) &&
      (!filters.shift || i.shift === filters.shift),
  );
}
