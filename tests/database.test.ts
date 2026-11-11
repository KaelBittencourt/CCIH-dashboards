import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  modules,
  normalizeSheet,
  summary,
  toCubes,
  type NormalizedRow,
} from "../shared/domain";
const admin = "11111111-1111-4111-8111-111111111111";
const reader = "22222222-2222-4222-8222-222222222222";
let pg: PGlite;
async function role(name: string, id = "") {
  await pg.exec(`reset role; set role ${name};`);
  await pg.query(
    "select set_config('request.jwt.claim.role',$1,false), set_config('request.jwt.claim.sub',$2,false)",
    [name, id],
  );
}
function fixture(): NormalizedRow[] {
  const m = modules[0];
  const headers = [
    "Carimbo de data/hora",
    "Data da auditoria",
    "Setor Auditado",
    "Turno:",
    m.responsibleHeader,
    ...m.indicators.map((i) => i.header),
    "Endereço de e-mail",
    "Observações",
  ];
  return normalizeSheet(m, [
    headers,
    [
      "2026-01-05T10:30:00",
      "2026-01-05",
      "Unidade de Internação",
      "Manhã",
      "Pessoa restrita",
      ...m.indicators.map((i) =>
        i.mode === "description" ? "Não visualizado" : "Sim",
      ),
      "privado@exemplo.test",
      "Observação restrita",
    ],
    [
      "2026-01-05T10:31:00",
      "8/26/0026",
      "Unidade de Internação",
      "Manhã",
      "Outro responsável",
      ...m.indicators.map((i) =>
        i.mode === "description" ? "Não visualizado" : "Não",
      ),
      "",
      "",
    ],
  ]);
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,invited_at timestamptz); grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;`);
  await pg.exec(
    readFileSync("supabase/migrations/202611110001_portal.sql", "utf8"),
  );
  await pg.query("insert into auth.users values($1,$2,now()),($3,$4,now())", [
    admin,
    "admin@exemplo.test",
    reader,
    "leitor@exemplo.test",
  ]);
  await pg.query("update public.profiles set role='admin' where id=$1", [
    admin,
  ]);
  // Reproduz conta convidada existente cujo perfil não foi criado pelo Auth.
  await pg.query("delete from public.profiles where id=$1", [reader]);
  await pg.exec(
    readFileSync(
      "supabase/migrations/202611110002_invited_profile.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await pg?.close();
});
describe.sequential(
  "PostgreSQL real: RLS, agregação e snapshots atômicos",
  () => {
    it("recupera perfis de convidados existentes e preserva administradores", async () => {
      await role("authenticated", reader);
      expect(
        (await pg.query<{ role: string }>("select role from public.profiles"))
          .rows[0].role,
      ).toBe("reader");
      await role("authenticated", admin);
      expect(
        (await pg.query<{ role: string }>("select role from public.profiles"))
          .rows[0].role,
      ).toBe("admin");
    });
    it("cria o perfil quando o convite é gravado após a criação da conta", async () => {
      await pg.exec("reset role");
      const invited = "44444444-4444-4444-8444-444444444444";
      await pg.query("insert into auth.users(id,email) values($1,$2)", [
        invited,
        "convite-posterior@exemplo.test",
      ]);
      expect(
        (await pg.query("select * from public.profiles where id=$1", [invited]))
          .rows,
      ).toHaveLength(0);
      await pg.query("update auth.users set invited_at=now() where id=$1", [
        invited,
      ]);
      await role("authenticated", invited);
      expect(
        (await pg.query<{ role: string }>("select role from public.profiles"))
          .rows[0].role,
      ).toBe("reader");
      expect(
        (await pg.query("select public.dashboard_snapshots()")).rows,
      ).toHaveLength(1);
      expect(
        (await pg.query("select * from public.audit_responses")).rows,
      ).toHaveLength(0);
      await pg.exec("reset role");
    });
    it("cadastro sem convite não recebe perfil nem acesso aos agregados", async () => {
      const uninvited = "33333333-3333-4333-8333-333333333333";
      await pg.query("insert into auth.users(id,email) values($1,$2)", [
        uninvited,
        "sem-convite@exemplo.test",
      ]);
      await role("authenticated", uninvited);
      expect(
        (await pg.query("select * from public.profiles")).rows,
      ).toHaveLength(0);
      await expect(
        pg.query("select public.dashboard_snapshots()"),
      ).rejects.toThrow("Acesso negado");
    });
    it("importação repetida é idempotente; atualização e exclusão substituem o snapshot", async () => {
      await role("service_role");
      const rows = fixture();
      for (let i = 0; i < 2; i++)
        await pg.query(
          "select public.replace_snapshot('cateter',$1::jsonb,'excel')",
          [JSON.stringify(rows)],
        );
      await role("authenticated", admin);
      expect(
        (await pg.query("select * from public.audit_responses")).rows,
      ).toHaveLength(2);
      await role("service_role");
      await pg.query(
        "select public.replace_snapshot('cateter',$1::jsonb,'google')",
        [JSON.stringify([rows[0]])],
      );
      await role("authenticated", admin);
      expect(
        (await pg.query("select * from public.audit_responses")).rows,
      ).toHaveLength(1);
      await role("service_role");
      await pg.query(
        "select public.replace_snapshot('cateter',$1::jsonb,'excel')",
        [JSON.stringify(rows)],
      );
    });
    it("retorna apenas agregados para leitor e usa as mesmas regras do frontend", async () => {
      await role("authenticated", reader);
      const result = await pg.query<{ snapshots: any[] }>(
        "select public.dashboard_snapshots() snapshots",
      );
      const cat = result.rows[0].snapshots.find((s) => s.module === "cateter");
      expect(summary(modules[0], cat.cubes)).toEqual(
        summary(modules[0], toCubes(fixture())),
      );
      const payload = JSON.stringify(result.rows);
      expect(payload).not.toContain("privado@");
      expect(payload).not.toContain("Observação restrita");
      expect(payload).not.toContain("Pessoa restrita");
      expect(
        (await pg.query("select * from public.audit_responses")).rows,
      ).toHaveLength(0);
      expect(
        (await pg.query("select * from public.sync_runs")).rows,
      ).toHaveLength(0);
    });
    it("bloqueia leitura anônima, escalada de perfil e importação por leitores", async () => {
      await role("anon");
      await expect(
        pg.query("select public.dashboard_snapshots()"),
      ).rejects.toThrow();
      await role("authenticated", reader);
      await expect(
        pg.query("update public.profiles set role='admin' where id=$1", [
          reader,
        ]),
      ).rejects.toThrow();
      await expect(
        pg.query("select public.replace_snapshot('cateter','[]','google')"),
      ).rejects.toThrow();
      await expect(
        pg.query(
          "insert into public.indicator_settings values('cateter','posicao',90)",
        ),
      ).rejects.toThrow();
    });
    it("administrador consulta registros e define metas sem expô-los a leitores", async () => {
      await role("authenticated", admin);
      const { rows } = await pg.query<{ private_data: { email: string } }>(
        "select private_data from public.audit_responses order by source_row",
      );
      expect(rows[0].private_data.email).toBe("privado@exemplo.test");
      await pg.query(
        "insert into public.indicator_settings values('cateter','posicao',90)",
      );
      await role("authenticated", reader);
      expect(
        (await pg.query("select target from public.indicator_settings")).rows,
      ).toHaveLength(1);
    });
    it("falha de gravação desfaz a exclusão e falha de outra fonte preserva o módulo válido", async () => {
      await role("service_role");
      const broken = { ...fixture()[0], source_row: null };
      await expect(
        pg.query(
          "select public.replace_snapshot('cateter',$1::jsonb,'google')",
          [JSON.stringify([broken])],
        ),
      ).rejects.toThrow();
      await pg.query(
        "select public.record_sync_failure('bloqueio','Falha de compartilhamento')",
      );
      await role("authenticated", admin);
      expect(
        (await pg.query("select * from public.audit_responses")).rows,
      ).toHaveLength(2);
      const { rows } = await pg.query<{ snapshots: any[] }>(
        "select public.dashboard_snapshots() snapshots",
      );
      expect(rows[0].snapshots.find((s) => s.module === "bloqueio").error).toBe(
        "Falha de compartilhamento",
      );
      expect(
        rows[0].snapshots.find((s) => s.module === "cateter").error,
      ).toBeNull();
    });
  },
);
