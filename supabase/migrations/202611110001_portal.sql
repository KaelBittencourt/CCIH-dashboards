-- Aplicar em um projeto Supabase novo. Nenhuma chave privilegiada pertence ao frontend.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'reader' check (role in ('admin', 'reader'))
);
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
create function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Cadastro direto não concede acesso, mesmo com signups habilitados por engano.
  if new.invited_at is not null then
    insert into public.profiles(id, role) values (new.id, 'reader');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create table public.sources (
  module text primary key check(module in ('cateter','bloqueio')),
  sheet_id text not null,
  origin text check(origin in ('excel','google')),
  updated_at timestamptz,
  last_attempt_at timestamptz,
  last_error text
);
insert into public.sources(module,sheet_id) values
 ('cateter','1TepvxI4u1g66PuvwMQjb_2GZCW7jgW3fHI6qtyzBxGA'),
 ('bloqueio','1VaQ4hf1GFm8fow3gSULHTem9CwIphgbPpgQDWGVe8js');
create table public.sync_runs (
  id bigint generated always as identity primary key,
  module text not null references public.sources(module),
  created_at timestamptz not null default now(),
  origin text not null,
  success boolean not null,
  row_count integer,
  error text
);
create table public.audit_responses (
  module text not null references public.sources(module),
  source_row integer not null,
  audit_date date,
  sector text not null,
  shift text not null,
  answers jsonb not null,
  date_issue text,
  private_data jsonb not null,
  primary key(module,source_row)
);
create table public.indicator_settings (
  module text not null references public.sources(module),
  indicator text not null,
  target numeric check(target >= 0 and target <= 100),
  primary key(module,indicator)
);
alter table public.sources enable row level security;
alter table public.sync_runs enable row level security;
alter table public.audit_responses enable row level security;
alter table public.indicator_settings enable row level security;
create policy admin_responses on public.audit_responses for select to authenticated using (public.is_admin());
create policy admin_runs on public.sync_runs for select to authenticated using (public.is_admin());
create policy member_settings on public.indicator_settings for select to authenticated using (exists(select 1 from public.profiles where id = auth.uid()));
create policy admin_settings on public.indicator_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.profiles, public.audit_responses, public.sync_runs, public.indicator_settings to authenticated;
grant insert, update, delete on public.indicator_settings to authenticated;
-- Alterações na origem, exclusões e inserções são aplicadas em uma única transação por módulo.
create function public.replace_snapshot(p_module text, p_rows jsonb, p_origin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_rows) <> 'array' or p_origin not in ('excel','google') then raise exception 'Snapshot inválido'; end if;
  perform 1 from public.sources where module = p_module for update;
  if not found then raise exception 'Módulo inválido'; end if;
  delete from public.audit_responses where module = p_module;
  insert into public.audit_responses(module,source_row,audit_date,sector,shift,answers,date_issue,private_data)
    select p_module,(r->>'source_row')::integer,(r->>'audit_date')::date,r->>'sector',r->>'shift',r->'answers',r->>'date_issue',
      jsonb_build_object('submitted_at',r->'submitted_at','responsible',r->'responsible','email',r->'email','observations',r->'observations','original',r->'original')
    from jsonb_array_elements(p_rows) r;
  update public.sources set origin=p_origin,updated_at=now(),last_attempt_at=now(),last_error=null where module=p_module;
  insert into public.sync_runs(module,origin,success,row_count) values(p_module,p_origin,true,jsonb_array_length(p_rows));
end; $$;
revoke all on function public.replace_snapshot(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.replace_snapshot(text,jsonb,text) to service_role;
create function public.record_sync_failure(p_module text,p_error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado'; end if;
  update public.sources set last_attempt_at=now(),last_error=p_error where module=p_module;
  insert into public.sync_runs(module,origin,success,error) values(p_module,'google',false,p_error);
end; $$;
revoke all on function public.record_sync_failure(text,text) from public, anon, authenticated;
grant execute on function public.record_sync_failure(text,text) to service_role;
-- Retorna distribuições agregadas; nenhum campo pessoal cruza esta interface.
create function public.dashboard_snapshots() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Acesso negado'; end if;
  with base as (
    select *,jsonb_build_array(audit_date,sector,shift) g from public.audit_responses
  ), grouped as (
    select module,g,audit_date,sector,shift,count(*) total,
      count(*) filter(where audit_date is null) invalid,
      count(*) filter(where audit_date is not null and date_issue is not null) discrepancy
    from base group by module,g,audit_date,sector,shift
  ), status_counts as (
    select module,g,e.key item,e.value #>> '{}' status,count(*) n
    from base cross join lateral jsonb_each(answers) e group by module,g,e.key,e.value
  ), item_counts as (
    select module,g,item,jsonb_object_agg(status,n) counts from status_counts group by module,g,item
  ), item_objects as (
    select module,g,jsonb_object_agg(item,counts) items from item_counts group by module,g
  ), cubes as (
    select a.module,jsonb_agg(jsonb_build_object('date',a.audit_date,'sector',a.sector,'shift',a.shift,'total',a.total,'invalid',a.invalid,'discrepancy',a.discrepancy,'items',coalesce(i.items,'{}'::jsonb))) cubes
    from grouped a left join item_objects i on i.module=a.module and i.g=a.g group by a.module
  )
  select coalesce(jsonb_agg(jsonb_build_object('module',s.module,'origin',s.origin,'updated_at',s.updated_at,'attempted_at',s.last_attempt_at,'error',s.last_error,'cubes',coalesce(c.cubes,'[]'::jsonb))),'[]'::jsonb)
  into result from public.sources s left join cubes c on c.module=s.module;
  return result;
end; $$;
revoke all on function public.dashboard_snapshots() from public, anon;
grant execute on function public.dashboard_snapshots() to authenticated;
revoke all on function public.create_profile() from public, anon, authenticated;
-- O primeiro administrador deve ser promovido pelo operador no SQL Editor.
-- update public.profiles set role='admin' where id=(select id from auth.users where email='EMAIL_DO_ADMIN');
