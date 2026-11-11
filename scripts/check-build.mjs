import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    ),
  );
  return nested.flat();
}
const files = await walk("dist");
assert(
  files.some((f) => f === "dist/index.html"),
  "Build sem index.html",
);
assert(
  !files.some((f) => /preview-data|\.private|\.map$/.test(f)),
  "Arquivo restrito no build",
);
const text = (
  await Promise.all(
    files
      .filter((f) => /\.(js|html|css|json)$/.test(f))
      .map((f) => readFile(f, "utf8")),
  )
).join("\n");
const preview = existsSync(".private/preview-data.json")
  ? JSON.parse(await readFile(".private/preview-data.json", "utf8"))
  : [];
for (const snapshot of preview)
  assert(
    !text.includes(snapshot.updated_at),
    "Fixture de desenvolvimento encontrada no build",
  );
for (const id of ["cateter", "bloqueio"]) {
  if (!existsSync(`.private/${id}.json`)) continue;
  const { values } = JSON.parse(await readFile(`.private/${id}.json`, "utf8"));
  const headers = values[0];
  const privateCols = headers.flatMap((h, i) =>
    /mail|observa|responsável/i.test(h) ? [i] : [],
  );
  for (const row of values.slice(1))
    for (const col of privateCols) {
      const v = String(row[col] ?? "").trim();
      // E-mails e textos livres completos são marcadores confiáveis; nomes curtos podem coincidir com código de bibliotecas.
      if (v.length > 15)
        assert(!text.includes(v), "Valor identificável encontrado no build");
    }
}
console.log(
  "Build verificado: sem fixtures locais, registros privados ou source maps.",
);
