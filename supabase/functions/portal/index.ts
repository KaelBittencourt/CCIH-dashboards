import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { modules, normalizeSheet } from "../../../shared/domain.ts";

const cors = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function b64url(data: Uint8Array | string) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
async function googleToken() {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw)
    throw new Error(
      "Integração Google pendente: configure a conta de serviço.",
    );
  const account = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))}`;
  const pem = account.private_key
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(new Uint8Array(signature))}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error("Falha na autenticação da conta de serviço Google.");
  return (await res.json()).access_token as string;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return response({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, secret, { auth: { persistSession: false } });
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!jwt) return response({ error: "Autenticação necessária" }, 401);
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(jwt);
    if (authError || !user) return response({ error: "Sessão inválida" }, 401);
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin")
      return response({ error: "Acesso reservado ao administrador" }, 403);
    const body = await req.json();
    if (body.action === "invite") {
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? "") ||
        !["reader", "admin"].includes(body.role)
      )
        return response({ error: "E-mail ou perfil inválido" }, 400);
      const origin = Deno.env.get("APP_ORIGIN");
      if (!origin)
        return response(
          { error: "Configure APP_ORIGIN antes de enviar convites." },
          503,
        );
      const { data, error } = await db.auth.admin.inviteUserByEmail(
        body.email,
        { redirectTo: origin },
      );
      if (error)
        return response(
          {
            error:
              "Não foi possível enviar o convite. Verifique se a conta já existe e a configuração de e-mail.",
          },
          400,
        );
      const { error: roleError } = await db
        .from("profiles")
        .update({ role: body.role })
        .eq("id", data.user!.id);
      if (roleError)
        return response(
          {
            error:
              "Convite enviado com perfil leitor; não foi possível definir o perfil solicitado.",
          },
          500,
        );
      return response({ ok: true });
    }
    if (body.action !== "sync")
      return response({ error: "Ação inválida" }, 400);
    let token: string;
    try {
      token = await googleToken();
    } catch {
      const error = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        ? "Falha ao autenticar no Google. Verifique as credenciais no servidor."
        : "Integração Google pendente: configure a conta de serviço.";
      for (const m of modules)
        await db.rpc("record_sync_failure", { p_module: m.id, p_error: error });
      return response({
        results: modules.map((m) => ({
          module: m.id,
          ok: false,
          message: error,
        })),
      });
    }
    const results = [];
    for (const module of modules) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const metadata = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${module.sheetId}?fields=sheets.properties.title`,
          { headers, signal: AbortSignal.timeout(15000) },
        );
        if (!metadata.ok)
          throw new Error(
            `Google Sheets (${metadata.status}): verifique o compartilhamento da planilha com a conta de serviço.`,
          );
        const title = (await metadata.json()).sheets?.[0]?.properties?.title;
        if (!title) throw new Error("Aba de respostas não encontrada.");
        const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'!A:AZ`);
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${module.sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
          { headers, signal: AbortSignal.timeout(15000) },
        );
        if (!res.ok) throw new Error(`Falha ao ler respostas (${res.status}).`);
        const rows = normalizeSheet(module, (await res.json()).values ?? []);
        const { error } = await db.rpc("replace_snapshot", {
          p_module: module.id,
          p_rows: rows,
          p_origin: "google",
        });
        if (error)
          throw new Error(
            "Falha ao gravar a nova versão. A última base foi preservada.",
          );
        results.push({
          module: module.id,
          ok: true,
          message: `${rows.length} respostas sincronizadas`,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Falha de sincronização";
        // Mensagens de validação não incluem observações ou credenciais.
        const safe = message.startsWith("Resposta não reconhecida")
          ? "Resposta não reconhecida no formulário. Revise a estrutura e os valores antes de sincronizar."
          : message;
        await db.rpc("record_sync_failure", {
          p_module: module.id,
          p_error: safe,
        });
        results.push({ module: module.id, ok: false, message: safe });
      }
    }
    return response({ results });
  } catch {
    return response(
      { error: "Falha interna. A última versão válida foi preservada." },
      500,
    );
  }
});
