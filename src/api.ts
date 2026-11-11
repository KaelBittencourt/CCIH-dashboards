import { createClient } from "@supabase/supabase-js";
import type { ModuleId, NormalizedRow, Snapshot } from "../shared/domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const anon =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const db =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export const localPreview =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_PREVIEW === "true" &&
  !db;
export type Targets = Record<string, number>;
export async function loadSnapshots(): Promise<Snapshot[]> {
  if (localPreview) return (await import("virtual:ccih-preview")).default;
  if (!db) throw new Error("Integração Supabase pendente.");
  const { data, error } = await db.rpc("dashboard_snapshots");
  if (error)
    throw new Error(
      "Não foi possível carregar os indicadores. Verifique sua conexão e seu acesso.",
    );
  return data as Snapshot[];
}
export async function loadTargets(): Promise<Targets> {
  if (!db) return {};
  const { data, error } = await db.from("indicator_settings").select("*");
  if (error) throw new Error("Não foi possível carregar as metas.");
  return Object.fromEntries(
    (data ?? [])
      .filter((r) => r.target !== null)
      .map((r) => [`${r.module}:${r.indicator}`, Number(r.target)]),
  );
}
export async function portalAction(body: Record<string, unknown>) {
  if (!db)
    throw new Error(
      "Integração pendente: a prévia local não sincroniza nem envia convites.",
    );
  const { data, error } = await db.functions.invoke("portal", { body });
  if (error)
    throw new Error(
      "Não foi possível executar a ação. Verifique sua sessão e a configuração da função portal.",
    );
  if (data.error) throw new Error(data.error);
  return data as {
    ok?: boolean;
    results?: { module: ModuleId; ok: boolean; message: string }[];
  };
}
export type Detail = {
  module: ModuleId;
  source_row: number;
  audit_date: string | null;
  sector: string;
  shift: string;
  answers: NormalizedRow["answers"];
  date_issue: string | null;
  private_data: Pick<
    NormalizedRow,
    "submitted_at" | "responsible" | "email" | "observations" | "original"
  >;
};
export async function loadDetails(module: ModuleId): Promise<Detail[]> {
  if (!db) return [];
  // Paginação impede o limite padrão de 1000 linhas de truncar o detalhamento.
  const rows: Detail[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db
      .from("audit_responses")
      .select("*")
      .eq("module", module)
      .order("source_row")
      .range(start, start + 999);
    if (error)
      throw new Error("Não foi possível carregar os registros restritos.");
    rows.push(...(data as Detail[]));
    if (data.length < 1000) break;
  }
  return rows;
}
