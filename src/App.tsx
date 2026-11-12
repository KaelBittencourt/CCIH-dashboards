import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Check,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileText,
  Filter,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Area,
  AreaChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  emptyCounts,
  evaluated,
  filterCubes,
  initialFilters,
  modules,
  monthly,
  previousMonth,
  ratio,
  statuses,
  statusLabels,
  sumItems,
  summary,
  type Cube,
  type Filters,
  type Module,
  type ModuleId,
  type Snapshot,
  type QualityIssuePage,
  type Counts,
  type Status,
} from "../shared/domain";
import {
  db,
  loadDetails,
  loadSnapshots,
  loadTargets,
  loadQualityIssues,
  localPreview,
  portalAction,
  type Detail,
  type Targets,
} from "./api";
import { exportCSV } from "./export";

type Page = "home" | ModuleId | "quality" | "method" | "admin";
type Theme = "light" | "dark" | "system";
const themeStorageKey = "ccih-theme-v2";
const months = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString("pt-BR", { month: "long" }),
);
const percent = (n: number | null) =>
  n === null
    ? "Sem avaliação"
    : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const formatTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ainda não sincronizado";
const niceDate = (s: string | null) =>
  s ? s.split("-").reverse().join("/") : "Data inválida";
const moduleIcon = (id: ModuleId, size = 20) =>
  id === "cateter" ? <Activity size={size} /> : <ShieldCheck size={size} />;
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Metric({
  label,
  value,
  detail,
  icon,
  small,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className={`metric ${small ? "compact" : ""}`}>
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
    </div>
  );
}

function Login({
  recovery,
  onDone,
  onPreview,
}: {
  recovery: boolean;
  onDone: () => void;
  onPreview: () => void;
}) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setMessage("");
    try {
      if (recovery) {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        onDone();
      } else if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin,
        });
        if (error) throw error;
        setMessage(
          "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
        );
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error)
          throw new Error(
            "Não foi possível entrar. Confira seu e-mail e senha.",
          );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="brand">
          <ShieldCheck size={30} />
          <div>
            CCIH<span>INTELIGÊNCIA ASSISTENCIAL</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">CUIDADO BASEADO EM EVIDÊNCIAS</span>
          <h1>
            Enxergar os dados.
            <br />
            Aprimorar o cuidado.
          </h1>
          <p>
            Um espaço para acompanhar práticas assistenciais e transformar
            auditorias em oportunidades de melhoria.
          </p>
          <div className="story-points">
            <span>
              <Check size={16} /> Indicadores com rastreabilidade
            </span>
            <span>
              <Check size={16} /> Auditorias em um só lugar
            </span>
            <span>
              <Check size={16} /> Acesso restrito à equipe
            </span>
          </div>
        </div>
        <small>Comissão de Controle de Infecção Hospitalar</small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <div className="icon-tile">
            <LockKeyhole />
          </div>
          <h2>
            {recovery
              ? "Defina sua senha"
              : mode === "reset"
                ? "Recuperar acesso"
                : "Bem-vindo ao portal"}
          </h2>
          <p>
            {recovery
              ? "Crie uma senha com pelo menos 12 caracteres."
              : "Entre com a conta convidada pela administração."}
          </p>
          {!db && (
            <div className="notice warning">
              <Database size={18} />
              <div>
                <strong>Integração pendente</strong>
                <p>
                  O portal está preparado. Configure o Supabase para ativar
                  login, convites e acesso aos indicadores.
                </p>
              </div>
            </div>
          )}
          <form onSubmit={submit}>
            {!recovery && (
              <label>
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu.email@hospital.com.br"
                  disabled={!db}
                />
              </label>
            )}
            {(recovery || mode === "login") && (
              <label>
                Senha
                <input
                  type="password"
                  autoComplete={recovery ? "new-password" : "current-password"}
                  minLength={recovery ? 12 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!db}
                />
              </label>
            )}
            <button className="primary wide" disabled={!db || busy}>
              {busy
                ? "Aguarde…"
                : recovery
                  ? "Salvar senha"
                  : mode === "reset"
                    ? "Enviar instruções"
                    : "Entrar no portal"}
              <ArrowRight size={16} />
            </button>
          </form>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
          {!recovery && (
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "login" ? "reset" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Esqueci minha senha" : "Voltar para o login"}
            </button>
          )}
          {localPreview && (
            <button
              className="secondary wide preview-button"
              onClick={onPreview}
            >
              Abrir prévia local agregada
              <ArrowUpRight size={16} />
            </button>
          )}
          <p className="login-foot">
            Contas são criadas por convite. Não há cadastro público.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(themeStorageKey);
    if (saved === "light" || saved === "dark" || saved === "system")
      return saved;
    const previous = localStorage.getItem("ccih-theme");
    return previous === "light" || previous === "dark" ? previous : "light";
  });
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "reader">("reader");
  const [preview, setPreview] = useState(localPreview);
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.hash.slice(1)).get("type") === "invite",
  );
  const [booting, setBooting] = useState(!!db);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    localStorage.setItem(themeStorageKey, theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!db) return;
    let live = true;
    async function accept(id: string | undefined, email: string | undefined) {
      if (!live) return;
      if (!id) {
        setUser(null);
        setSnapshots([]);
        setTargets({});
        setBooting(false);
        return;
      }
      const { data, error } = await db!
        .from("profiles")
        .select("role")
        .eq("id", id)
        .single();
      if (!live) return;
      if (error || !data) {
        setMessage(
          "Sua conta ainda não possui acesso. Contate a administração.",
        );
        setUser(null);
      } else {
        setRole(data.role);
        setUser(email ?? "Equipe CCIH");
      }
      setBooting(false);
    }
    db.auth
      .getSession()
      .then(({ data }) =>
        accept(data.session?.user.id, data.session?.user.email),
      )
      .catch(() => {
        if (live) {
          setBooting(false);
          setMessage("Não foi possível verificar sua sessão.");
        }
      });
    const { data: listener } = db.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setTimeout(() => {
        if (live) void accept(session?.user.id, session?.user.email);
      }, 0);
    });
    return () => {
      live = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  async function reload() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([loadSnapshots(), loadTargets()]);
      setSnapshots(s);
      setTargets(t);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao carregar os dados");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user || preview) void reload();
  }, [user, preview]);
  const admin = role === "admin" && !preview;
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const data = await portalAction({ action: "sync" });
      setMessage(
        data.results
          ?.map(
            (r) =>
              `${modules.find((m) => m.id === r.module)?.title}: ${r.message}`,
          )
          .join(" • ") ?? "Solicitação concluída.",
      );
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na atualização");
    } finally {
      setBusy(false);
    }
  }
  function navigate(p: Page) {
    setPage(p);
    setMobile(false);
  }
  if (booting)
    return (
      <div className="loading-page">
        <ShieldCheck />
        <p>Verificando acesso…</p>
      </div>
    );
  if ((!user && !preview) || recovery)
    return (
      <>
        <Login
          recovery={recovery}
          onDone={() => {
            setRecovery(false);
            history.replaceState({}, "", location.pathname);
          }}
          onPreview={() => setPreview(true)}
        />
        {message && (
          <div className="toast" role="alert">
            {message}
            <button aria-label="Fechar mensagem" onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  const activeModule = modules.find((m) => m.id === page);
  const titles: Record<string, string> = {
    home: "Visão geral",
    quality: "Qualidade dos dados",
    method: "Metodologia",
    admin: "Administração",
  };
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <ShieldCheck size={30} />
          <div>
            CCIH<span>INTELIGÊNCIA ASSISTENCIAL</span>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          <span className="nav-heading">ACOMPANHAMENTO</span>
          <button
            className={page === "home" ? "active" : ""}
            onClick={() => navigate("home")}
          >
            <LayoutDashboard size={19} />
            Visão geral
          </button>
          <span className="nav-heading panels-heading">
            PAINÉIS ASSISTENCIAIS
          </span>
          {modules.map((m) => (
            <button
              key={m.id}
              className={page === m.id ? "active" : ""}
              onClick={() => navigate(m.id)}
            >
              {moduleIcon(m.id)}
              {m.title}
              <ChevronRight size={14} className="nav-arrow" />
            </button>
          ))}
          <div className="nav-divider" />
          <button
            className={page === "quality" ? "active" : ""}
            onClick={() => navigate("quality")}
          >
            <Database size={19} />
            Qualidade dos dados
          </button>
          <button
            className={page === "method" ? "active" : ""}
            onClick={() => navigate("method")}
          >
            <FileText size={19} />
            Metodologia
          </button>
          {admin && (
            <button
              className={page === "admin" ? "active" : ""}
              onClick={() => navigate("admin")}
            >
              <SlidersHorizontal size={19} />
              Administração
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-box">
            <div className="avatar">{preview ? "PV" : "CC"}</div>
            <div>
              <strong>
                {preview ? "Prévia local" : admin ? "Administrador" : "Leitor"}
              </strong>
              <small>{preview ? "Somente dados agregados" : user}</small>
            </div>
            <button
              aria-label={preview ? "Voltar ao login" : "Sair"}
              title="Sair"
              onClick={async () => {
                if (db) await db.auth.signOut();
                setPreview(false);
                setSnapshots([]);
                setPage("home");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <span>Portal CCIH</span>
            <ChevronRight size={13} />
            <strong>{activeModule?.title ?? titles[page]}</strong>
          </div>
          <div className="top-actions">
            <span className="restricted">
              <LockKeyhole size={13} /> Acesso restrito
            </span>
            <div className="theme-picker" aria-label="Tema">
              {(
                [
                  {
                    value: "light",
                    label: "Tema claro",
                    icon: <Sun size={15} />,
                  },
                  {
                    value: "dark",
                    label: "Tema escuro",
                    icon: <Moon size={15} />,
                  },
                  {
                    value: "system",
                    label: "Tema automático",
                    icon: <Monitor size={15} />,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.value}
                  title={t.label}
                  aria-label={t.label}
                  aria-pressed={theme === t.value}
                  onClick={() => setTheme(t.value)}
                  className={theme === t.value ? "selected" : ""}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main id="main-content">
          {preview && (
            <div className="preview-strip">
              <span>
                <Database size={15} />
                <strong>Prévia local · importação Excel</strong>
                <span>
                  Dados agregados reais. Login e Google Sheets aguardam
                  configuração.
                </span>
              </span>
              <Badge>Não sincronizado com Google</Badge>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                COMISSÃO DE CONTROLE DE INFECÇÃO HOSPITALAR
              </span>
              <h1>
                {activeModule?.title ?? titles[page]}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {activeModule?.subtitle ??
                  (page === "home"
                    ? "Acompanhe as auditorias e identifique oportunidades de melhoria."
                    : page === "quality"
                      ? "Transparência sobre datas, preenchimento e origem dos indicadores."
                      : page === "method"
                        ? "Entenda o que está por trás de cada número."
                        : "Gerencie convites, metas e informações restritas.")}
              </p>
            </div>
            <div className="heading-actions">
              {activeModule && (
                <button
                  className="secondary icon-button"
                  aria-label="Imprimir relatório"
                  title="Imprimir relatório"
                  onClick={() => window.print()}
                >
                  <FileText size={17} />
                </button>
              )}
              <button
                className="primary"
                onClick={admin ? sync : reload}
                disabled={busy || loading}
              >
                <RefreshCw
                  size={16}
                  className={busy || loading ? "spin" : ""}
                />
                {busy
                  ? "Sincronizando…"
                  : admin
                    ? "Atualizar dados"
                    : "Recarregar painel"}
              </button>
            </div>
          </div>
          {message && (
            <div className="notice" role="status">
              <TriangleAlert size={18} />
              <p>{message}</p>
              <button
                className="icon-button"
                aria-label="Fechar mensagem"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "home" && (
            <Overview
              snapshots={snapshots}
              navigate={navigate}
              loading={loading}
              filters={filters}
              setFilters={setFilters}
            />
          )}
          {activeModule && (
            <Dashboard
              module={activeModule}
              snapshot={snapshots.find((s) => s.module === activeModule.id)}
              filters={filters}
              setFilters={setFilters}
              targets={targets}
            />
          )}
          {page === "quality" && (
            <Quality
              snapshots={snapshots}
              filters={filters}
              setFilters={setFilters}
            />
          )}
          {page === "method" && <Methodology />}
          {page === "admin" && admin && (
            <Administration targets={targets} onChange={reload} />
          )}
          <footer className="footer">
            <span>
              Portal CCIH <span> / </span> Inteligência assistencial
            </span>
            <span>
              Respostas de auditoria · Não representam pacientes únicos
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function OverviewTrend({
  module,
  series,
}: {
  module: Module;
  series: ReturnType<typeof monthly>;
}) {
  const latest = series.filter((point) => point.percent !== null).at(-1);
  if (!latest) return null;
  return (
    <div className="spark-trend">
      <div className="spark-heading">
        <div>
          <h4>Conformidade mensal</h4>
          <span>Itens conformes entre os avaliados</span>
        </div>
        <div className="spark-latest">
          <strong>{percent(latest.percent)}</strong>
          <span>Último mês · {latest.label}</span>
        </div>
      </div>
      <div
        className="spark-chart"
        role="img"
        aria-label={`Evolução mensal da conformidade de ${module.title}, de 0 a 100 por cento, entre ${series[0].period} e ${series.at(-1)!.period}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={series}
            margin={{ top: 14, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              minTickGap={22}
              interval="preserveStartEnd"
              tickMargin={10}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v) => `${v}%`}
              width={38}
              tick={{ fill: "var(--muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload;
                return active && point && point.percent !== null ? (
                  <div className="chart-tooltip">
                    <strong>{point.label}</strong>
                    <p>Conformidade: {percent(point.percent)}</p>
                    <p>
                      {point.numerator}/{point.denominator} oportunidades
                      avaliadas
                    </p>
                    <p>
                      {point.total}{" "}
                      {point.total === 1 ? "resposta" : "respostas"} de
                      auditoria
                    </p>
                  </div>
                ) : null;
              }}
            />
            <Area
              dataKey="percent"
              name="Conformidade (%)"
              type="linear"
              stroke="var(--accent)"
              strokeWidth={2.5}
              fill="var(--accent-soft)"
              fillOpacity={1}
              dot={{
                r: 2.5,
                fill: "var(--surface)",
                stroke: "var(--accent)",
                strokeWidth: 1.5,
              }}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Overview({
  snapshots: sourceSnapshots,
  navigate,
  loading,
  filters,
  setFilters,
}: {
  snapshots: Snapshot[];
  navigate: (p: Page) => void;
  loading: boolean;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const snapshots = sourceSnapshots.map((s) => ({
    ...s,
    cubes: filterCubes(s.cubes, filters),
  }));
  const allCubes = sourceSnapshots.flatMap((s) => s.cubes);
  const excludedDates =
    filters.year || filters.month
      ? filterCubes(allCubes, { ...filters, year: "", month: "" }).reduce(
          (n, c) => n + c.invalid,
          0,
        )
      : 0;
  const total = snapshots.reduce(
    (n, s) => n + s.cubes.reduce((a, c) => a + c.total, 0),
    0,
  );
  const invalid = snapshots.reduce(
    (n, s) => n + s.cubes.reduce((a, c) => a + c.invalid, 0),
    0,
  );
  const discrepancy = snapshots.reduce(
    (n, s) => n + s.cubes.reduce((a, c) => a + c.discrepancy, 0),
    0,
  );
  const sectors = new Set(
    snapshots.flatMap((s) => s.cubes.map((c) => c.sector)),
  ).size;
  return (
    <>
      <FilterBar cubes={allCubes} filters={filters} setFilters={setFilters} />
      {excludedDates > 0 && (
        <div className="quality-note">
          <TriangleAlert size={15} />
          {excludedDates} respostas com data inválida ficam fora deste período.
          Selecione “Todo o histórico” e “Todos os meses” para revisá-las.
        </div>
      )}
      <div className="overview-stats">
        <Metric
          label="Respostas de auditoria"
          value={loading ? "…" : total}
          detail="Nos dois módulos, conforme os filtros"
          icon={<ClipboardCheck size={18} />}
        />
        <Metric
          label="Painéis disponíveis"
          value="02"
          detail="Estrutura preparada para novos módulos"
          icon={<LayoutDashboard size={18} />}
        />
        <Metric
          label="Setores com registros"
          value={sectors}
          detail={
            sectors === 1
              ? "Unidade de Internação"
              : "Conforme fontes importadas"
          }
          icon={<Users size={18} />}
        />
        <Metric
          label="Registros para revisão"
          value={invalid + discrepancy}
          detail={`${invalid} datas inválidas · ${discrepancy} divergência de data`}
          icon={<TriangleAlert size={18} />}
        />
      </div>
      <div className="section-heading">
        <div>
          <h2>Painéis assistenciais</h2>
          <p>Indicadores independentes para cada frente de auditoria.</p>
        </div>
        <Badge>2 módulos</Badge>
      </div>
      <div className="module-grid">
        {modules.map((m) => {
          const s = snapshots.find((s) => s.module === m.id);
          const stats = summary(m, s?.cubes ?? []);
          const series = monthly(m, s?.cubes ?? []);
          return (
            <article className="module-card" key={m.id}>
              <div className="module-card-top">
                <div className={`icon-tile ${m.id}`}>
                  {moduleIcon(m.id, 24)}
                </div>
                <Badge tone={s?.updated_at ? "" : "amber"}>
                  {s?.origin === "google"
                    ? "Google Sheets"
                    : s?.origin === "excel"
                      ? "Importação Excel"
                      : "Integração pendente"}
                </Badge>
              </div>
              <h3>{m.title}</h3>
              <p>{m.subtitle}</p>
              <div className="module-numbers">
                <div>
                  <strong>{stats.total}</strong>
                  <span>respostas</span>
                </div>
                <div className="module-conformity">
                  <strong>{percent(stats.percent)}</strong>
                  <div className="module-conformity-count">
                    <b>{stats.numerator} de {stats.denominator}</b>
                    <span>itens conformes</span>
                  </div>
                </div>
              </div>
              {series.length > 0 && (
                <OverviewTrend module={m} series={series} />
              )}
              <p className="source-caption">
                {stats.percent === null
                  ? s?.updated_at
                    ? "Sem avaliações para os filtros selecionados."
                    : "Nenhuma base carregada."
                  : !series.length
                    ? "Sem datas válidas para a evolução mensal."
                    : `Índice ponderado por oportunidades avaliadas · ${series[0]?.period} a ${series.at(-1)?.period}`}
              </p>
              <div className="module-card-footer">
                <span>
                  <span className={`status-dot ${s?.error ? "warn" : ""}`} />
                  {s?.error
                    ? "Falha na última tentativa"
                    : s?.updated_at
                      ? formatTime(s.updated_at)
                      : "Aguardando configuração"}
                </span>
                <a
                  className="text-button source-sheet-link"
                  href={`https://docs.google.com/spreadsheets/d/${m.sheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir planilha de ${m.title} no Google Sheets (nova aba)`}
                >
                  Planilha
                  <ExternalLink size={13} />
                </a>
                <button onClick={() => navigate(m.id)}>
                  Explorar painel
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="overview-bottom">
        <div className="insight-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LEITURA RESPONSÁVEL</span>
              <h2>Conformidade e cobertura caminham juntas.</h2>
            </div>
            <Activity size={24} />
          </div>
          <p>
            Um resultado alto pode considerar poucas avaliações. Em cada painel,
            consulte o numerador, o denominador e os itens não avaliados antes
            de interpretar o percentual.
          </p>
          <button className="text-button" onClick={() => navigate("method")}>
            Conhecer a metodologia
            <ArrowRight size={16} />
          </button>
        </div>
        <button className="quality-link" onClick={() => navigate("quality")}>
          <TriangleAlert size={24} />
          <div>
            <h3>Qualidade dos dados</h3>
            <p>
              {excludedDates || invalid} datas inválidas não entram nas análises
              por período.
            </p>
            <span>
              Revisar pendências
              <ArrowUpRight size={16} />
            </span>
          </div>
        </button>
      </div>
      <div className="overview-banner">
        <div>
          <Badge tone="mint">MONITORAMENTO ASSISTENCIAL</Badge>
          <h2>
            Cada auditoria, uma oportunidade
            <br />
            de aprimorar o cuidado.
          </h2>
          <p>
            Explore os painéis para acompanhar a adesão às práticas
            <br className="desktop-break" /> e priorizar os pontos que precisam
            de atenção.
          </p>
        </div>
        <div className="banner-emblem" aria-hidden="true">
          <ShieldCheck size={86} strokeWidth={1} />
          <span>QUALIDADE & SEGURANÇA</span>
        </div>
      </div>
    </>
  );
}

function FilterBar({
  cubes,
  filters,
  setFilters,
}: {
  cubes: Cube[];
  filters: Filters;
  setFilters: (v: Filters) => void;
}) {
  const years = [
    ...new Set(cubes.flatMap((c) => (c.date ? [c.date.slice(0, 4)] : []))),
  ]
    .sort()
    .reverse();
  const field = (
    id: keyof Filters,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={filters[id]}
        onChange={(e) => setFilters({ ...filters, [id]: e.target.value })}
      >
        <option value="">
          {id === "year"
            ? "Todo o histórico"
            : id === "month"
              ? "Todos os meses"
              : "Todos"}
        </option>
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="filter-bar">
      <div className="filter-intro">
        <Filter size={17} />
        <span>Filtros</span>
      </div>
      {field(
        "month",
        "Mês",
        months.map((m, i) => ({
          value: String(i + 1).padStart(2, "0"),
          label: m,
        })),
      )}
      {field(
        "year",
        "Ano",
        years.map((v) => ({ value: v, label: v })),
      )}
      {field(
        "sector",
        "Setor",
        [...new Set(cubes.map((c) => c.sector))]
          .sort()
          .map((v) => ({ value: v, label: v })),
      )}
      {field(
        "shift",
        "Turno",
        [...new Set(cubes.map((c) => c.shift))]
          .sort()
          .map((v) => ({ value: v, label: v })),
      )}
      <button
        className="text-button"
        onClick={() => setFilters(initialFilters)}
      >
        Limpar
      </button>
    </div>
  );
}

function Dashboard({
  module,
  snapshot,
  filters,
  setFilters,
  targets,
}: {
  module: Module;
  snapshot?: Snapshot;
  filters: Filters;
  setFilters: (f: Filters) => void;
  targets: Targets;
}) {
  const all = snapshot?.cubes ?? [];
  const cubes = filterCubes(all, filters);
  const stats = summary(module, cubes);
  const trend = monthly(
    module,
    filterCubes(all, { ...filters, month: "" }),
    filters.year,
  );
  const comparisonMonth =
    filters.year && filters.month
      ? { year: filters.year, month: filters.month }
      : null;
  const previous = comparisonMonth
    ? summary(
        module,
        filterCubes(all, {
          ...filters,
          ...previousMonth(comparisonMonth.year, comparisonMonth.month),
        }),
      )
    : null;
  const delta =
    previous?.percent != null && stats.percent != null
      ? stats.percent - previous.percent
      : null;
  const focusIds =
    module.id === "cateter"
      ? ["fixacao_adequada", "identificacao"]
      : ["placa", "adesivo"];
  const counts = module.indicators
    .filter((i) => i.eligible)
    .reduce((a, i) => {
      const c = sumItems(cubes, i.id);
      for (const s of statuses) a[s] += c[s];
      return a;
    }, emptyCounts());
  const composition = statuses
    .filter((s) => counts[s] > 0)
    .map((s) => ({
      name: statusLabels[s],
      value: counts[s],
      fill: `var(--status-${s})`,
    }));
  const ranking = module.indicators
    .filter((i) => i.eligible)
    .map((i) => ({ ...i, counts: sumItems(cubes, i.id) }))
    .sort((a, b) => b.counts.nao_conforme - a.counts.nao_conforme);
  const [tab, setTab] = useState<"analysis" | "items">("analysis");
  return (
    <>
      <FilterBar cubes={all} filters={filters} setFilters={setFilters} />
      <div className="report-meta">
        <span>
          {snapshot?.origin === "excel"
            ? "Importação Excel"
            : snapshot?.origin === "google"
              ? "Google Sheets"
              : "Integração pendente"}{" "}
          · {formatTime(snapshot?.updated_at)}
        </span>
        <button
          className="text-button"
          onClick={() => exportCSV(module, cubes, filters, snapshot)}
          disabled={!stats.total}
        >
          <ArrowDownToLine size={15} />
          Exportar CSV
        </button>
      </div>
      {snapshot?.error && (
        <div className="notice warning">
          <TriangleAlert size={18} />
          <div>
            <strong>Última atualização não concluída</strong>
            <p>
              {snapshot.error} Dados exibidos: última versão válida. Tentativa:{" "}
              {formatTime(snapshot.attempted_at)}.
            </p>
          </div>
        </div>
      )}
      {summary(module, all).invalid > 0 && (
        <div className="quality-note">
          <TriangleAlert size={15} />
          {summary(module, all).invalid} respostas com data inválida: incluídas
          apenas no histórico sem filtro de mês/ano. Não entram na evolução
          mensal.
        </div>
      )}
      <div
        className={`dashboard-stats ${module.id === "bloqueio" ? "six" : ""}`}
      >
        <Metric
          label="Respostas no período"
          value={stats.total}
          detail="Uma linha = uma resposta de auditoria"
        />
        <Metric
          label={
            module.id === "cateter"
              ? "Índice de manutenção"
              : "Conformidade dos itens elegíveis"
          }
          value={percent(stats.percent)}
          detail={`${stats.numerator}/${stats.denominator} oportunidades avaliadas`}
        />
        {focusIds.map((id) => {
          const item = module.indicators.find((i) => i.id === id)!;
          const c = sumItems(cubes, id);
          return (
            <Metric
              key={id}
              label={item.label}
              value={percent(ratio(c.conforme, evaluated(c)))}
              detail={`${c.conforme}/${evaluated(c)} respostas avaliadas`}
            />
          );
        })}
        <Metric
          label="Cobertura de avaliação"
          value={percent(stats.coverage)}
          detail={`${stats.denominator}/${stats.opportunities} oportunidades elegíveis`}
        />
        {module.id === "bloqueio" &&
          (() => {
            const assessed =
              evaluated(sumItems(cubes, "colocacao")) +
              evaluated(sumItems(cubes, "retirada"));
            return (
              <Metric
                label="Cobertura da paramentação"
                value={percent(ratio(assessed, stats.total * 2))}
                detail={`${assessed}/${stats.total * 2} oportunidades de colocação/retirada`}
              />
            );
          })()}
      </div>
      <div className="comparison">
        <Activity size={17} />
        {comparisonMonth ? (
          delta === null ? (
            <span>
              Comparação mensal indisponível: um dos meses não possui
              avaliações.
            </span>
          ) : (
            <span>
              <strong>
                {delta > 0 ? "+" : ""}
                {delta.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}{" "}
                p.p.
              </strong>{" "}
              em relação ao mês anterior · {stats.total} respostas atuais /{" "}
              {previous?.total} anteriores
            </span>
          )
        ) : (
          <span>
            Selecione um mês e um ano para comparar com o mês anterior.
          </span>
        )}
      </div>
      <div className="tabs" role="tablist" aria-label="Visualização">
        <button
          role="tab"
          aria-selected={tab === "analysis"}
          onClick={() => setTab("analysis")}
        >
          Análise visual
        </button>
        <button
          role="tab"
          aria-selected={tab === "items"}
          onClick={() => setTab("items")}
        >
          Todos os indicadores <span>{module.indicators.length}</span>
        </button>
      </div>
      {!stats.total ? (
        <div className="empty-panel">
          <Database size={32} />
          <h2>
            {all.length
              ? "Sem respostas para estes filtros"
              : "Aguardando a primeira importação"}
          </h2>
          <p>
            {all.length
              ? "Ajuste o período, o setor ou o turno."
              : "Configure a integração e importe o Excel ou sincronize as planilhas."}
          </p>
        </div>
      ) : tab === "analysis" ? (
        <>
          <div className="chart-grid">
            <section className="panel trend-panel">
              <div className="panel-heading">
                <div>
                  <h2>Evolução da conformidade</h2>
                  <p>Índice mensal · oportunidades avaliadas</p>
                </div>
                <Badge>Mensal</Badge>
              </div>
              <div
                className="trend-chart"
                role="img"
                aria-label="Conformidade mensal, em percentual"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trend}
                    margin={{ top: 20, right: 20, bottom: 22, left: 2 }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: "Mês da auditoria",
                        position: "insideBottom",
                        offset: -15,
                        fill: "var(--muted)",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        const p = payload?.[0]?.payload;
                        return active && p ? (
                          <div className="chart-tooltip">
                            <strong>{p.period}</strong>
                            <p>Conformidade: {percent(p.percent)}</p>
                            <p>
                              {p.numerator}/{p.denominator} oportunidades ·{" "}
                              {p.total} respostas
                            </p>
                          </div>
                        ) : null;
                      }}
                    />
                    <Line
                      dataKey="percent"
                      name="Conformidade (%)"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--surface)", strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="source-caption">
                Fonte: {module.title} · {trend[0]?.period ?? "—"} a{" "}
                {trend.at(-1)?.period ?? "—"}. Eixo Y: conformidade (%). Meses
                sem avaliações são conectados visualmente entre os pontos
                existentes, sem gerar valores para esses meses.
              </p>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Composição das respostas</h2>
                  <p>Somente itens elegíveis para o índice</p>
                </div>
              </div>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={composition}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={77}
                      paddingAngle={2}
                      stroke="none"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{stats.opportunities}</strong>
                  <span>oportunidades</span>
                </div>
              </div>
              <div className="legend">
                {composition.map((c) => (
                  <div key={c.name}>
                    <span style={{ background: c.fill }} />
                    <span>{c.name}</span>
                    <strong>{c.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel ranking-panel">
            <div className="panel-heading">
              <div>
                <h2>Onde estão as não conformidades?</h2>
                <p>
                  Itens elegíveis ordenados pela quantidade de respostas não
                  conformes.
                </p>
              </div>
              <Badge>Sem metas clínicas presumidas</Badge>
            </div>
            <div className="rank-list">
              {ranking.map((i) => (
                <div className="rank-row" key={i.id}>
                  <span>{i.label}</span>
                  <div className="rank-track">
                    <div
                      style={{
                        width: `${ratio(i.counts.nao_conforme, stats.total) ?? 0}%`,
                      }}
                    />
                  </div>
                  <strong>{i.counts.nao_conforme}</strong>
                  <small>de {evaluated(i.counts)} avaliadas</small>
                </div>
              ))}
            </div>
            <p className="source-caption">
              Eixo horizontal: quantidade de respostas não conformes, escala de
              0 a {stats.total}. Respostas parciais são apresentadas
              separadamente na tabela de indicadores.
            </p>
          </section>
          <Indicators module={module} cubes={cubes} targets={targets} />
        </>
      ) : (
        <Indicators module={module} cubes={cubes} targets={targets} />
      )}
      <div className="print-method">
        <strong>Metodologia:</strong> conformidade = conformes ÷ (conformes +
        não conformes + parciais) × 100; índice ponderado pelas oportunidades
        avaliadas. Não avaliados, não visualizados e vazios ficam fora do
        denominador. Critérios pendentes e descritivos não pontuam. Filtros:{" "}
        {filters.year || "todos os anos"}, {filters.month || "todos os meses"},{" "}
        {filters.sector || "todos os setores"},{" "}
        {filters.shift || "todos os turnos"}. Atualização:{" "}
        {formatTime(snapshot?.updated_at)}.
      </div>
    </>
  );
}

function responseLabel(status: Status, unscored: boolean) {
  if (unscored && status === "conforme") return "Sim / conforme (original)";
  if (unscored && status === "nao_conforme")
    return "Não / não conforme (original)";
  return statusLabels[status];
}

function responseColor(status: Status, unscored: boolean) {
  if (unscored && status === "conforme") return "var(--status-descritivo)";
  if (unscored && status === "nao_conforme") return "var(--muted)";
  return `var(--status-${status})`;
}

function ResponseComposition({
  counts,
  denominator,
  unscored,
  full = false,
  target,
  label,
}: {
  counts: Counts;
  denominator: number;
  unscored: boolean;
  full?: boolean;
  target?: number;
  label: string;
}) {
  const categories: Status[] =
    full || unscored ? statuses : ["conforme", "nao_conforme", "parcial"];
  const description = denominator
    ? categories
        .filter((s) => counts[s] > 0)
        .map(
          (s) =>
            `${responseLabel(s, unscored)}: ${counts[s]} (${percent(ratio(counts[s], denominator))})`,
        )
        .join("; ")
    : "Sem avaliação";
  return (
    <span
      className={`response-composition ${full ? "large" : ""} ${denominator ? "" : "is-empty"}`}
      role="img"
      aria-label={`${label}. ${description}${target !== undefined && denominator ? `. Meta definida pela CCIH: ${target}%` : ""}`}
    >
      {denominator > 0 &&
        categories
          .filter((s) => counts[s] > 0)
          .map((s) => (
            <span
              className="response-segment"
              key={s}
              style={{
                width: `${ratio(counts[s], denominator)}%`,
                background: responseColor(s, unscored),
              }}
              title={`${responseLabel(s, unscored)}: ${counts[s]} · ${percent(ratio(counts[s], denominator))}`}
              aria-hidden="true"
            />
          ))}
      {target !== undefined && denominator > 0 && (
        <span
          className="response-target"
          style={{ left: `${target}%` }}
          aria-hidden="true"
          title={`Meta CCIH: ${target}%`}
        />
      )}
    </span>
  );
}

function Indicators({
  module,
  cubes,
  targets,
}: {
  module: Module;
  cubes: Cube[];
  targets: Targets;
}) {
  return (
    <section className="panel indicators-panel">
      <div className="panel-heading">
        <div>
          <h2>Indicadores em detalhe</h2>
          <p>
            Compare as barras de conformidade e abra um item para explorar suas
            respostas.
          </p>
        </div>
      </div>
      <div
        className="indicator-reading-key"
        aria-label="Legenda das barras de conformidade"
      >
        {(["conforme", "nao_conforme", "parcial"] as Status[]).map((s) => (
          <span key={s}>
            <span style={{ background: responseColor(s, false) }} />
            {statusLabels[s]}
          </span>
        ))}
        <span>
          <span className="empty-key" />
          Sem avaliação
        </span>
      </div>
      <p className="indicator-visual-note">
        Barras de conformidade consideram apenas respostas avaliadas. Itens
        pendentes e descritivos mostram a distribuição original em cores
        neutras, sem pontuação.
      </p>
      <div className="indicator-table">
        <div className="indicator-head">
          <span>INDICADOR</span>
          <span>CONFORMIDADE</span>
          <span>AVALIADAS</span>
          <span>REGRA</span>
        </div>
        {module.indicators.map((i) => {
          const c = sumItems(cubes, i.id);
          const n = evaluated(c);
          const p = ratio(c.conforme, n);
          const target = targets[`${module.id}:${i.id}`];
          const total = statuses.reduce((sum, s) => sum + c[s], 0);
          const unscored = !!i.mode;
          return (
            <details className="indicator-row" key={i.id}>
              <summary>
                <div>
                  <ChevronRight size={15} />
                  <span>{i.label}</span>
                </div>
                <span className="indicator-percent">
                  {i.mode === "pending"
                    ? "Pendente"
                    : i.mode === "description"
                      ? "Descritivo"
                      : percent(p)}
                  <ResponseComposition
                    counts={c}
                    denominator={unscored ? total : n}
                    unscored={unscored}
                    target={!unscored && i.eligible ? target : undefined}
                    label={`${i.label}: ${unscored ? "distribuição original" : "composição das avaliações"}`}
                  />
                </span>
                <span>{i.mode ? "—" : `${c.conforme}/${n}`}</span>
                <span>
                  <Badge
                    tone={
                      i.mode === "pending" ? "amber" : i.eligible ? "mint" : ""
                    }
                  >
                    {i.eligible
                      ? "Compõe o índice"
                      : i.mode === "pending"
                        ? "Validar com CCIH"
                        : "Individual"}
                  </Badge>
                </span>
              </summary>
              <div className="indicator-expanded">
                {i.note && <p>{i.note}</p>}
                {i.mode ? (
                  <p>
                    Sem classificação de adequação: “Sim/conforme” e “Não/não
                    conforme” abaixo representam apenas as categorias originais,
                    sem pontuação.
                  </p>
                ) : (
                  <p>
                    Conformidade: {c.conforme} conformes ÷ {n} avaliadas × 100.
                    Parcialmente conforme permanece no denominador.
                  </p>
                )}
                <div className="indicator-composition-heading">
                  <strong>Distribuição de todas as respostas</strong>
                  <span>
                    {total} {total === 1 ? "resposta" : "respostas"}
                  </span>
                </div>
                <ResponseComposition
                  counts={c}
                  denominator={total}
                  unscored={unscored}
                  full
                  label={`Todas as respostas de ${i.label}`}
                />
                <div
                  className="indicator-distribution-chart"
                  aria-label={`Distribuição por categoria de ${i.label}`}
                >
                  {statuses.map((s) => (
                    <div key={s} className={c[s] ? "" : "is-zero"}>
                      <span className="category-label">
                        <span
                          style={{ background: responseColor(s, unscored) }}
                        />
                        {responseLabel(s, unscored)}
                      </span>
                      <span className="category-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${ratio(c[s], total) ?? 0}%`,
                            background: responseColor(s, unscored),
                          }}
                        />
                      </span>
                      <strong>
                        {c[s]} · {percent(ratio(c[s], total))}
                      </strong>
                    </div>
                  ))}
                </div>
                {i.id === "instalacao" && c.descritivo > 0 && (
                  <p>
                    Na importação inicial, o registro descritivo é “Uso de
                    Clorexidina aquosa 1%”. O texto de registros atuais pode ser
                    consultado por um administrador, sem inferir adequação.
                  </p>
                )}
                {target !== undefined && i.eligible && (
                  <p>
                    Meta definida pela CCIH: {target}%.{" "}
                    {p === null
                      ? "Sem avaliação para comparar."
                      : p >= target
                        ? "Meta atingida neste recorte."
                        : "Abaixo da meta neste recorte."}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Quality({
  snapshots: sourceSnapshots,
  filters,
  setFilters,
}: {
  snapshots: Snapshot[];
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const allCubes = sourceSnapshots.flatMap((s) => s.cubes);
  const snapshots = sourceSnapshots.map((s) => ({
    ...s,
    cubes: filterCubes(s.cubes, filters),
  }));
  const excludedDates =
    filters.year || filters.month
      ? filterCubes(allCubes, { ...filters, year: "", month: "" }).reduce(
          (n, c) => n + c.invalid,
          0,
        )
      : 0;
  return (
    <>
      <FilterBar cubes={allCubes} filters={filters} setFilters={setFilters} />
      {excludedDates > 0 && (
        <div className="notice warning">
          <TriangleAlert size={18} />
          <p>
            {excludedDates} respostas com data inválida não podem ser atribuídas
            a este período. Limpe os filtros de ano e mês para revisar essas
            pendências no histórico completo.
          </p>
        </div>
      )}
      <div className="quality-grid">
        {modules.map((m) => {
          const s = snapshots.find((s) => s.module === m.id);
          const stats = summary(m, s?.cubes ?? []);
          const blanks = m.indicators.reduce(
            (n, i) => n + sumItems(s?.cubes ?? [], i.id).vazio,
            0,
          );
          const unassessed = m.indicators.reduce(
            (n, i) => n + sumItems(s?.cubes ?? [], i.id).nao_avaliado,
            0,
          );
          return (
            <section className="panel" key={m.id}>
              <div className="panel-heading">
                <div className="module-title">
                  {moduleIcon(m.id)}
                  <h2>{m.title}</h2>
                </div>
                <a
                  className="secondary sheet-link"
                  href={`https://docs.google.com/spreadsheets/d/${m.sheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir planilha de ${m.title} no Google Sheets (nova aba)`}
                >
                  <ExternalLink size={14} />
                  Abrir planilha
                </a>
              </div>
              <div className="quality-period-summary">
                <span>
                  {stats.total} {stats.total === 1 ? "resposta" : "respostas"}{" "}
                  no recorte
                </span>
                <Badge>
                  {s?.origin === "excel"
                    ? "Excel"
                    : s?.origin === "google"
                      ? "Google Sheets"
                      : "Pendente"}
                </Badge>
              </div>
              <div className="quality-kpis">
                <Metric
                  small
                  label="Datas inválidas"
                  value={stats.invalid}
                  detail="Fora de análises por mês/ano"
                />
                <Metric
                  small
                  label="Divergências de data"
                  value={stats.discrepancy}
                  detail="Mais de 30 dias entre auditoria e envio"
                />
                <Metric
                  small
                  label="Itens em branco"
                  value={blanks}
                  detail="Não contam como não conformidade"
                />
                <Metric
                  small
                  label="Itens não avaliados"
                  value={unassessed}
                  detail="Separados de respostas vazias"
                />
              </div>
              <dl className="source-details">
                <div>
                  <dt>Última base válida</dt>
                  <dd>{formatTime(s?.updated_at)}</dd>
                </div>
                <div>
                  <dt>Última tentativa Google</dt>
                  <dd>{formatTime(s?.attempted_at)}</dd>
                </div>
                <div>
                  <dt>Situação</dt>
                  <dd>
                    {s?.error
                      ? s.error
                      : s?.origin === "google"
                        ? "Sincronização concluída"
                        : "Conexão Google ainda não confirmada"}
                  </dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
      <QualityIssueTable filters={filters} snapshots={sourceSnapshots} />
      <section className="panel prose">
        <h2>Como as pendências são tratadas</h2>
        <p>
          Datas inválidas são preservadas na origem e exibidas no histórico
          completo. Uma data válida com divergência de envio continua sendo a
          referência do filtro, acompanhada de um aviso. O sistema não substitui
          a data da auditoria pelo carimbo de envio.
        </p>
        <p>
          Espaços e caixa são normalizados nas respostas. Nomes não são unidos
          por semelhança. Não há edição automática do formulário original.
        </p>
        <p>
          Para corrigir: um administrador consulta o número da linha no
          detalhamento, revisa o registro no Google Sheets e executa uma nova
          sincronização. A versão anterior permanece disponível até a leitura e
          validação completas da nova base.
        </p>
        <p>
          O botão “Abrir planilha” leva à fonte original no Google Sheets. A
          permissão para editar é controlada pelo Google. Após corrigir,
          solicite a um administrador a sincronização para atualizar os
          indicadores.
        </p>
      </section>
    </>
  );
}

function QualityIssueTable({
  filters,
  snapshots,
}: {
  filters: Filters;
  snapshots: Snapshot[];
}) {
  const filterKey = JSON.stringify([
    filters.year,
    filters.month,
    filters.sector,
    filters.shift,
  ]);
  const [pagination, setPagination] = useState({ filterKey: "", page: 1 });
  const page = pagination.filterKey === filterKey ? pagination.page : 1;
  const [data, setData] = useState<QualityIssuePage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    setData(null);
    loadQualityIssues(filters, page)
      .then((result) => {
        if (!live) return;
        const last = Math.max(1, Math.ceil(result.total / 25));
        if (page > last) setPagination({ filterKey, page: last });
        else setData(result);
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar as pendências.",
          );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [
    filters.year,
    filters.month,
    filters.sector,
    filters.shift,
    page,
    retry,
    snapshots,
  ]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));
  return (
    <section
      className="panel issue-panel"
      aria-labelledby="quality-issues-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="quality-issues-title">Linhas para revisão</h2>
          <p>
            Datas inválidas, divergências de data e respostas em branco no
            recorte selecionado.
          </p>
        </div>
        <Badge tone="amber">
          {data
            ? `${data.total} ${data.total === 1 ? "pendência" : "pendências"}`
            : "Revisão da fonte"}
        </Badge>
      </div>
      <p className="issue-explainer">
        Uma linha pode aparecer mais de uma vez quando há vários campos a
        revisar. “Não avaliado” é uma resposta válida e não é listado como erro
        de preenchimento.
      </p>
      {busy ? (
        <p className="issue-status" role="status">
          Carregando linhas…
        </p>
      ) : error ? (
        <div className="notice warning" role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !data?.items.length ? (
        <p className="issue-status">
          Nenhuma pendência de preenchimento encontrada para estes filtros.
        </p>
      ) : (
        <>
          <div
            className="issue-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Tabela de linhas com pendências"
          >
            <table className="issue-table">
              <colgroup>
                <col className="issue-col-source" />
                <col className="issue-col-row" />
                <col className="issue-col-field" />
                <col className="issue-col-value" />
                <col className="issue-col-status" />
                <col className="issue-col-details" />
                <col className="issue-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Planilha</th>
                  <th scope="col">Linha</th>
                  <th scope="col">Campo</th>
                  <th scope="col">Valor informado</th>
                  <th scope="col">Pendência</th>
                  <th scope="col">Detalhes</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => {
                  const m = modules.find((m) => m.id === i.module)!;
                  const field =
                    i.field_key === "audit_date"
                      ? "Data da auditoria"
                      : (m.indicators.find((f) => f.id === i.field_key)
                          ?.label ?? "Campo do formulário");
                  const value =
                    i.field_key === "audit_date" && i.audit_date
                      ? niceDate(i.audit_date)
                      : i.raw_value || "Em branco";
                  return (
                    <tr key={`${i.module}:${i.source_row}:${i.field_key}`}>
                      <td>{m.title}</td>
                      <td>
                        <strong>{i.source_row}</strong>
                      </td>
                      <td>{field}</td>
                      <td className="issue-value">{value}</td>
                      <td>
                        <Badge tone="amber">
                          {i.issue_type === "invalid_date"
                            ? "Data inválida"
                            : i.issue_type === "date_discrepancy"
                              ? "Conferir data"
                              : "Resposta em branco"}
                        </Badge>
                      </td>
                      <td className="issue-details">
                        {i.field_key === "audit_date" && (
                          <div>
                            {i.issue_type === "date_discrepancy" ? (
                              <span>
                                Mais de 30 dias entre auditoria e envio.
                              </span>
                            ) : null}
                            <span>
                              Envio:{" "}
                              {i.reference_date
                                ? niceDate(i.reference_date)
                                : "Não informado"}
                              .
                            </span>
                          </div>
                        )}
                        {i.field_key !== "audit_date" && (
                          <span>Campo não preenchido.</span>
                        )}
                      </td>
                      <td>
                        <a
                          className="text-button issue-row-link"
                          href={`https://docs.google.com/spreadsheets/d/${m.sheetId}/edit#range=${i.source_row}:${i.source_row}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Revisar linha ${i.source_row} de ${m.title} no Google Sheets (nova aba)`}
                        >
                          Abrir linha
                          <ExternalLink size={13} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="issue-pagination">
            <span>
              Página {page} de {pages} · {data.total}{" "}
              {data.total === 1 ? "pendência" : "pendências"}
            </span>
            <div>
              <button
                className="secondary"
                disabled={busy || page <= 1}
                onClick={() => setPagination({ filterKey, page: page - 1 })}
              >
                Anterior
              </button>
              <button
                className="secondary"
                disabled={busy || page >= pages}
                onClick={() => setPagination({ filterKey, page: page + 1 })}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
      <p className="source-caption">
        A numeração inclui o cabeçalho da planilha. O link destaca a linha
        original; após a correção, sincronize a fonte para atualizar este
        quadro.
      </p>
    </section>
  );
}

function Methodology() {
  return (
    <div className="method-layout">
      <section className="panel prose">
        <span className="eyebrow">01 / CÁLCULO</span>
        <h2>Números que podem ser conferidos</h2>
        <div className="formula">
          Conformidade = conformes ÷ avaliadas × 100
        </div>
        <p>
          Avaliadas = conformes + não conformes + parcialmente conformes. Não
          avaliado, não visualizado e em branco são categorias distintas e ficam
          fora do denominador. Se não há avaliações, o resultado é “Sem
          avaliação”.
        </p>
        <p>
          O índice do módulo soma conformes e oportunidades avaliadas de todos
          os itens elegíveis. Não é uma média simples dos percentuais. A
          cobertura divide oportunidades avaliadas pelo total de oportunidades
          elegíveis.
        </p>
        <span className="eyebrow">02 / INTERPRETAÇÃO</span>
        <h2>O que estes painéis mostram</h2>
        <p>
          Cada registro representa uma resposta de auditoria. Os dados não
          identificam pacientes únicos, não medem incidência de infecção e não
          contêm denominadores de pacientes-dia ou cateteres-dia.
        </p>
        <p>
          As comparações são descritivas. Sempre considere o tamanho das
          amostras. A diferença mensal é apresentada em pontos percentuais;
          meses sem observações não recebem valor zero.
        </p>
        <span className="eyebrow">03 / DATAS E FONTES</span>
        <h2>A data da auditoria orienta a análise</h2>
        <p>
          Registros com datas inválidas aparecem somente no histórico sem
          filtros de mês/ano. O carimbo do formulário é usado para
          rastreabilidade. Exibição de horários no fuso America/Sao_Paulo.
        </p>
        <p>
          O botão de sincronização consulta as duas planilhas em modo somente
          leitura. Falhas são informadas por módulo e não apagam a última base
          válida. “Recarregar painel” apenas consulta novamente a base já
          importada.
        </p>
      </section>
      <aside className="method-aside">
        <section className="panel prose">
          <ShieldCheck size={28} />
          <h2>Critérios do índice</h2>
          <h3>Cateter vesical</h3>
          <p>
            Posição da bolsa, fluxo livre, bolsa suspensa, fixação adequada e
            identificação.
          </p>
          <h3>Medidas de bloqueio</h3>
          <p>
            Placa, adesivo, conhecimento dos isolamentos, estações disponíveis e
            adequadas, colocação e retirada da paramentação e lixeira comum.
          </p>
        </section>
        <section className="panel prose pending-panel">
          <TriangleAlert size={24} />
          <h2>Aguardam validação</h2>
          <p>
            Volume da bolsa em 2/3, profissional exclusivo para EPC e lixeira
            reciclável não compõem os índices. Nenhuma meta clínica é presumida.
          </p>
          <p>
            A técnica de instalação de SVD é apenas descritiva. Presença de
            fixação é individual para não duplicar o peso da fixação adequada.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Administration({
  targets,
  onChange,
}: {
  targets: Targets;
  onChange: () => Promise<void>;
}) {
  const [moduleId, setModuleId] = useState<ModuleId>("cateter");
  const [details, setDetails] = useState<Detail[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reader");
  const [indicator, setIndicator] = useState("posicao");
  const [target, setTarget] = useState("");
  const module = modules.find((m) => m.id === moduleId)!;
  useEffect(() => {
    let live = true;
    setBusy(true);
    setDetails([]);
    loadDetails(moduleId)
      .then((r) => {
        if (live) setDetails(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [moduleId]);
  const filtered = details.filter(
    (r) =>
      (!filters.year || r.audit_date?.slice(0, 4) === filters.year) &&
      (!filters.month || r.audit_date?.slice(5, 7) === filters.month) &&
      (!filters.sector || r.sector === filters.sector) &&
      (!filters.shift || r.shift === filters.shift) &&
      (!onlyIssues || !!r.date_issue),
  );
  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await portalAction({ action: "invite", email, role });
      setError("Convite enviado.");
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no convite");
    } finally {
      setBusy(false);
    }
  }
  async function saveTarget(e: FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    try {
      const value = target.trim() === "" ? null : Number(target);
      if (
        value !== null &&
        (!Number.isFinite(value) || value < 0 || value > 100)
      )
        throw new Error("Meta deve estar entre 0 e 100.");
      const { error } = await db
        .from("indicator_settings")
        .upsert({ module: moduleId, indicator, target: value });
      if (error) throw new Error("Não foi possível salvar a meta.");
      await onChange();
      setError("Meta atualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar meta");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="notice" role="status">
          <p>{error}</p>
          <button
            className="icon-button"
            aria-label="Fechar mensagem"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="admin-grid">
        <section className="panel prose">
          <h2>Convidar integrante</h2>
          <p>
            Apenas pessoas convidadas têm acesso. O e-mail de convite permite
            definir a senha.
          </p>
          <form onSubmit={invite}>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Perfil
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="reader">Leitor · indicadores agregados</option>
                <option value="admin">
                  Administrador · dados restritos e sincronização
                </option>
              </select>
            </label>
            <button className="primary" disabled={busy}>
              Enviar convite
              <ArrowRight size={16} />
            </button>
          </form>
        </section>
        <section className="panel prose">
          <h2>Meta definida pela CCIH</h2>
          <p>
            Metas são opcionais e não alteram as regras de classificação das
            respostas.
          </p>
          <form onSubmit={saveTarget}>
            <label>
              Módulo
              <select
                value={moduleId}
                onChange={(e) => {
                  const id = e.target.value as ModuleId;
                  setModuleId(id);
                  setIndicator(
                    modules
                      .find((m) => m.id === id)!
                      .indicators.find((i) => i.eligible)!.id,
                  );
                  setTarget("");
                }}
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Indicador
              <select
                value={indicator}
                onChange={(e) => {
                  setIndicator(e.target.value);
                  setTarget("");
                }}
              >
                {module.indicators
                  .filter((i) => i.eligible)
                  .map((i) => (
                    <option value={i.id} key={i.id}>
                      {i.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Meta (%) · deixe vazio para remover
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder={String(
                  targets[`${moduleId}:${indicator}`] ?? "Não definida",
                )}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              Salvar meta
              <Check size={16} />
            </button>
          </form>
        </section>
      </div>
      <section className="panel details-panel">
        <div className="panel-heading">
          <div>
            <h2>Registros restritos · {module.title}</h2>
            <p>
              Responsáveis, observações e e-mails não são enviados a leitores.
            </p>
          </div>
          <Badge tone="amber">Administrador</Badge>
        </div>
        <FilterBar
          cubes={details.map((r) => ({
            date: r.audit_date,
            sector: r.sector,
            shift: r.shift,
            total: 1,
            invalid: 0,
            discrepancy: 0,
            items: {},
          }))}
          filters={filters}
          setFilters={setFilters}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
          />
          Apenas pendências de data
        </label>
        <p className="source-caption">
          {busy ? "Carregando…" : `${filtered.length} registros neste recorte`}
        </p>
        <div className="details-list">
          {filtered.map((r) => (
            <details key={r.source_row}>
              <summary>
                <span>
                  Linha {r.source_row} · {niceDate(r.audit_date)} · {r.shift}
                </span>
                {r.date_issue && <Badge tone="amber">Revisar data</Badge>}
              </summary>
              <div className="record-details">
                <dl>
                  <div>
                    <dt>Setor</dt>
                    <dd>{r.sector}</dd>
                  </div>
                  <div>
                    <dt>Envio</dt>
                    <dd>{r.private_data.submitted_at}</dd>
                  </div>
                  <div>
                    <dt>Responsável pela unidade</dt>
                    <dd>{r.private_data.responsible || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>E-mail do formulário</dt>
                    <dd>{r.private_data.email || "Não coletado"}</dd>
                  </div>
                </dl>
                {r.date_issue && <p className="quality-note">{r.date_issue}</p>}
                <h3>Observações originais</h3>
                <p className="original-text">
                  {r.private_data.observations || "Sem observações"}
                </p>
                <h3>Campos originais</h3>
                <dl className="original-fields">
                  {Object.entries(r.private_data.original).map(([h, v]) => (
                    <div key={h}>
                      <dt>{h}</dt>
                      <dd>{String(v ?? "Em branco")}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
