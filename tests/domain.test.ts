import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import {
  classify,
  emptyCounts,
  evaluated,
  filterCubes,
  initialFilters,
  modules,
  monthly,
  normalizeSheet,
  parseDate,
  previousMonth,
  ratio,
  sumItems,
  summary,
  toCubes,
} from "../shared/domain";
import { csvCell } from "../src/export";

describe("normalização e cálculos", () => {
  const cat = modules[0],
    bloqueio = modules[1];
  it("valida datas sem corrigir silenciosamente anos ou dias", () => {
    expect(parseDate("8/26/0026")).toBeNull();
    expect(parseDate("8/27/0027")).toBeNull();
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("29/02/2024")).toBe("2024-02-29");
    expect(parseDate("24/02/2026 08:12:43")).toBe("2026-02-24");
    expect(parseDate(45926)).toBe("2025-09-26");
    expect(previousMonth("2026", "01")).toEqual({ year: "2025", month: "12" });
  });
  it("preserva vazio, não avaliado, parcial, não visualizado e descritivo", () => {
    const i = cat.indicators[0];
    expect(classify(" SIm ", i)).toBe("conforme");
    expect(classify(null, i)).toBe("vazio");
    expect(classify("Não avaliado", i)).toBe("nao_avaliado");
    expect(classify("parcialmente", i)).toBe("parcial");
    expect(classify("Não visualizado", cat.indicators[9])).toBe(
      "nao_visualizado",
    );
    expect(classify("Uso de Clorexidina aquosa 1%", cat.indicators[9])).toBe(
      "descritivo",
    );
    expect(() => classify("Talvez", i)).toThrow();
  });
  it("não calcula média simples, pontuação parcial ou divisão por zero", () => {
    const items = Object.fromEntries(
      cat.indicators.map((i) => [i.id, emptyCounts()]),
    );
    items.posicao.conforme = 1;
    items.fluxo.nao_conforme = 9;
    items.fluxo.parcial = 1;
    // Estes itens não devem pesar no índice.
    items.fixacao.conforme = 100;
    items.volume.conforme = 100;
    const s = summary(cat, [
      {
        date: "2026-01-01",
        sector: "A",
        shift: "Manhã",
        total: 10,
        invalid: 0,
        discrepancy: 0,
        items,
      },
    ]);
    expect(s.numerator).toBe(1);
    expect(s.denominator).toBe(11);
    expect(s.percent).toBeCloseTo(100 / 11);
    expect(ratio(0, 0)).toBeNull();
    expect(evaluated({ ...emptyCounts(), parcial: 2 })).toBe(2);
    expect(summary(cat, []).percent).toBeNull();
  });
  it("rejeita estrutura incompatível antes de produzir nova versão", () => {
    expect(() => normalizeSheet(cat, [])).toThrow("cabeçalhos");
    expect(() => normalizeSheet(cat, [["Carimbo de data/hora"]])).toThrow(
      "Coluna obrigatória",
    );
    expect(() => normalizeSheet(cat, [["1. Nome", "2. Nome"]])).toThrow(
      "duplicados",
    );
  });
  it("escapa CSV e neutraliza fórmulas", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("A;B")).toBe('"A;B"');
  });
  describe.skipIf(!existsSync(".private/cateter.json"))(
    "arquivos reais (privados, somente no ambiente de importação)",
    () => {
      const read = (id: string) =>
        JSON.parse(readFileSync(`.private/${id}.json`, "utf8")).values;
      it("reproduz 44 respostas de cateter, oito datas inválidas e fixação sem peso duplicado", () => {
        const rows = normalizeSheet(cat, read("cateter"));
        const cubes = toCubes(rows);
        const s = summary(cat, cubes);
        expect(rows).toHaveLength(44);
        expect(s.invalid).toBe(8);
        expect(s.discrepancy).toBe(0);
        expect(s.numerator).toBe(168);
        expect(s.denominator).toBe(219);
        expect(s.opportunities).toBe(220);
        expect(sumItems(cubes, "fixacao_adequada").conforme).toBe(6);
        expect(sumItems(cubes, "identificacao").conforme).toBe(32);
        expect(sumItems(cubes, "higiene").nao_avaliado).toBe(44);
        expect(sumItems(cubes, "fluxo").vazio).toBe(1);
        expect(
          filterCubes(cubes, { ...initialFilters, year: "2026" }).every(
            (c) => c.date,
          ),
        ).toBe(true);
        expect(
          filterCubes(cubes, { ...initialFilters, month: "08" }),
        ).toHaveLength(0);
        const trend = monthly(cat, cubes);
        expect(trend.find((p) => p.period === "2026-01")?.percent).toBeNull();
        expect(trend.reduce((n, p) => n + p.total, 0)).toBe(36);
        expect(toCubes(normalizeSheet(cat, read("cateter")))).toEqual(cubes);
      });
      it("reproduz 23 respostas de bloqueio, duas datas inválidas e uma divergência", () => {
        const rows = normalizeSheet(bloqueio, read("bloqueio"));
        const cubes = toCubes(rows);
        const s = summary(bloqueio, cubes);
        expect(rows).toHaveLength(23);
        expect(s.invalid).toBe(2);
        expect(s.discrepancy).toBe(1);
        expect(s.numerator).toBe(152);
        expect(s.denominator).toBe(173);
        expect(s.opportunities).toBe(184);
        expect(sumItems(cubes, "disponiveis").parcial).toBe(1);
        expect(sumItems(cubes, "adesivo").conforme).toBe(10);
        expect(sumItems(cubes, "retirada").nao_avaliado).toBe(5);
        expect(
          filterCubes(cubes, {
            ...initialFilters,
            year: "2025",
            month: "03",
          }).reduce((n, c) => n + c.total, 0),
        ).toBe(1);
      });
    },
  );
});
