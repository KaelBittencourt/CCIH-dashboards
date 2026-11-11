# Portal CCIH

Aplicação web em português para auditorias de **Cateter Vesical** e **Medidas de Bloqueio**. React/TypeScript, Recharts, Supabase Auth/PostgreSQL e Edge Function para Google Sheets em modo somente leitura.

## Estado da entrega

- Interface implementada: visão geral, dois módulos, filtros, comparação mensal, temas claro/escuro/automático, CSV agregado, impressão e metodologia.
- Administração implementada: convites, metas opcionais e consulta restrita de registros originais.
- Migração com RLS e RPCs de agregação e substituição transacional; função de sincronização pronta para implantação.
- Arquivos Excel extraídos localmente: 44 e 23 respostas. Nomes, e-mails e observações ficam **apenas em `.private/`**, ignorado pelo Git e fora do build.
- Sem credenciais, o build de produção mostra **Integração pendente**. A prévia agregada real está disponível somente no servidor de desenvolvimento; não existe bypass de login em produção.

## Executar localmente

Requisitos: Node.js 24+, npm; Python com openpyxl para extrair os arquivos Excel.

```powershell
npm ci
# .env.local já foi criado neste ambiente; em outro ambiente:
Copy-Item .env.example .env.local
# Para prévia local sem Supabase: VITE_ENABLE_LOCAL_PREVIEW=true em .env.local
npm run dev
```

A prévia não sincroniza planilhas, envia convites ou permite consultar dados identificáveis. A indicação de importação Excel permanece visível. Quando URL/chave pública do Supabase estão configuradas, o portal usa autenticação real mesmo no desenvolvimento.

Para recriar a importação (sem alterar as planilhas):

```powershell
python scripts/import_excel.py --downloads "C:\Users\kaelb\Downloads"
npx tsx scripts/prepare-preview.ts
```

O script Python grava matrizes originais em `.private/`. O segundo script gera **somente contagens agregadas** em `.private/preview-data.json`. Esse arquivo não é versionado nem incluído no build de produção. O servidor local só disponibiliza esses agregados quando a prévia é habilitada explicitamente, sem Supabase configurado.

## Configurar Supabase

1. Criar um projeto Supabase e aplicar todas as migrações de `supabase/migrations/` em ordem pelo SQL Editor ou `supabase db push` em projeto vinculado. Não aplicar novamente a mesma migração manualmente.
2. Desabilitar **Allow new users to sign up** nas configurações de autenticação. O `supabase/config.toml` também desabilita cadastro no ambiente local. Contas de produção devem ser criadas por convite.
3. Configurar Site URL e Redirect URLs com a origem exata do portal. Para testes locais, incluir `http://127.0.0.1:5174`. Configurar SMTP para entrega de convites e recuperação de senha. Usar política de senha mínima de 12 caracteres.
4. Convidar o primeiro administrador em Authentication → Users. O gatilho cria perfil leitor no INSERT ou na atualização posterior de `invited_at`. A segunda migração também recupera perfis ausentes de contas já convidadas, sem alterar perfis existentes. Promover **somente essa conta** pelo SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'EMAIL_DO_ADMIN');
```

5. Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou a antiga `VITE_SUPABASE_ANON_KEY`) em `.env.local` (desenvolvimento) ou `.env.production.local` (build hospedado). A chave pública/anon pertence ao navegador; a service role nunca deve receber prefixo `VITE_`.
6. Para importar os Excel no banco, definir `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente local privado e executar:

```powershell
node --env-file=.env.local scripts/seed.mjs
```

O seed valida cabeçalhos e respostas antes de chamar `replace_snapshot`. A gravação é atômica por módulo e idempotente; executar novamente não duplica dados. O seed requer `.private/cateter.json` e `.private/bloqueio.json` gerados pela extração.

## Conectar Google Sheets

1. No Google Cloud, habilitar a Google Sheets API e criar uma conta de serviço. Compartilhar as duas planilhas como **Leitor** com o e-mail dessa conta. Não é necessário publicar as planilhas na web.
2. Guardar o JSON da conta como segredo `GOOGLE_SERVICE_ACCOUNT_JSON` da Edge Function; definir `APP_ORIGIN` com a origem do portal. As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidas pelo ambiente Supabase da função. Nunca registrar o JSON em arquivos versionados.
3. Implantar a função com `supabase functions deploy portal --no-verify-jwt`. A desativação do verificador de gateway é intencional: a função valida o token com `auth.getUser` e consulta o perfil **em toda chamada**. Não remover essas verificações.
4. Entrar como administrador e clicar em **Atualizar dados**. A função lê a primeira aba das duas fontes; manter a aba de respostas nessa posição. A seleção da aba é explícita pelo título retornado na API, não depende do gid.

Planilhas:

- Cateter: `1TepvxI4u1g66PuvwMQjb_2GZCW7jgW3fHI6qtyzBxGA`
- Bloqueio: `1VaQ4hf1GFm8fow3gSULHTem9CwIphgbPpgQDWGVe8js`

Datas numéricas da API são interpretadas como seriais do Sheets; strings brasileiras e ISO são validadas estritamente. Os valores brutos permanecem no registro original. Fuso de exibição: `America/Sao_Paulo`.

Cabeçalhos são normalizados por caixa, acento, espaços e prefixo numérico. Coluna obrigatória ausente, duplicada ou resposta desconhecida impede a troca da base. Uma planilha com cabeçalhos válidos e sem respostas é uma exclusão completa válida. Cada módulo é independente: uma falha não impede o sucesso do outro.

Leitores usam **Recarregar painel** para consultar a base importada. Só administradores podem executar sincronização, consultar campos privados, enviar convites e definir metas.

## Contratos e regras

- `shared/domain.ts`: catálogo dos módulos, mapeamento de cabeçalhos, normalização, cubos agregados, filtros e cálculos. É compartilhado pelo importador e pela função de servidor.
- `dashboard_snapshots()`: RPC autenticada retorna módulo, origem, atualização, última falha e distribuições por data/setor/turno. Não retorna responsáveis, e-mails, observações ou linhas originais.
- `audit_responses`: leitura direta permitida apenas a administradores por RLS; paginação no detalhamento. `private_data.original` preserva cada campo recebido.
- `portal` POST `{action:"sync"}` → `{results:[{module,ok,message}]}`; POST `{action:"invite",email,role:"reader"|"admin"}` → `{ok:true}`. Ambos exigem JWT válido e perfil administrador.
- `replace_snapshot` e `record_sync_failure`: executáveis somente pela service role. Nunca chamá-los diretamente pelo frontend.
- Conformidade: conformes/(conformes + não conformes + parciais). Não avaliados, não visualizados e vazios são categorias separadas, excluídas desse denominador. Parcial não recebe crédito.
- Índice: soma dos numeradores/soma dos denominadores dos itens elegíveis. Fixação adequada entra uma vez; presença de fixação permanece individual.
- Volume em 2/3, profissional exclusivo EPC e lixeira reciclável: pendentes, sem pontuação. Instalação SVD: descritiva. Alterações nas regras exigem validação da CCIH e revisão do catálogo; a tela de metas não altera classificação.
- Datas inválidas: incluídas no histórico sem filtro de mês/ano, excluídas dos recortes temporais. Divergência superior a 30 dias é sinalizada sem substituir a data declarada.
- Metas opcionais definidas pela equipe; nenhum limite clínico é presumido. Comparação mensal em pontos percentuais, com tamanho das amostras. Meses ausentes são lacunas.
- Responsáveis não são auditores. Nomes não são mesclados por aproximação; qualquer equivalência deve ser confirmada pela equipe e implementada explicitamente.

## Testar e publicar

```powershell
npm test
npm run build
```

Os testes de banco executam a migração em PostgreSQL WASM (PGlite), com papéis e claims de autenticação simulados, para verificar RLS, agregação, idempotência, exclusões e rollback. Os testes dos arquivos reais são executados quando `.private/` existe; fixtures sintéticas sempre são testadas. Autenticação, SMTP e Google reais exigem ambiente configurado e teste de integração após implantação.

O build Vite gera `dist/`, declarado em `.openai/hosting.json` para Sites. Variáveis `VITE_` são incorporadas **durante o build**: após configurar/alterar Supabase, recompilar e republicar. Sem credenciais, publicar entrega a tela de integração pendente, nunca uma falsa sessão ou sincronização.

Antes de liberar uso pela equipe, validar no ambiente real: convite de leitor/administrador, definição/recuperação de senha, login/logout, sincronização das duas fontes, erro de compartilhamento de uma fonte e acesso negado aos registros originais com JWT de leitor. Confirmar os três critérios pendentes com a CCIH antes de alterar elegibilidade.

## Adicionar um módulo

Adicionar catálogo e adaptador ao domínio, cadastrar a fonte no banco e incluir o módulo na lista permitida de `sources.module`. O menu, filtros e visualizações utilizam o catálogo. Criar testes das regras e dos cabeçalhos do novo formulário. Não criar um índice global combinando frentes diferentes.
