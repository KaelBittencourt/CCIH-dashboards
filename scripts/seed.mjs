import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
// Executar com: node --env-file=.env.local scripts/seed.mjs
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do processo.",
  );
const { modules, normalizeSheet } = await import("../shared/domain.ts");
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
for (const module of modules) {
  const { values } = JSON.parse(
    await readFile(`.private/${module.id}.json`, "utf8"),
  );
  const rows = normalizeSheet(module, values);
  const { error } = await db.rpc("replace_snapshot", {
    p_module: module.id,
    p_rows: rows,
    p_origin: "excel",
  });
  if (error) throw error;
  console.log(`${module.id}: ${rows.length} respostas importadas.`);
}
