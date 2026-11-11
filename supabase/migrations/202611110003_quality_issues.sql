-- Pendências sanitizadas: linha, datas e campo vazio. Não retorna nomes, e-mails ou observações.
create or replace function public.quality_issues(
  p_year text default null, p_month text default null,
  p_sector text default null, p_shift text default null, p_page integer default 1
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Acesso negado';
  end if;
  with filtered as (
    select r.*,
      coalesce((select left(e.value,80) from jsonb_each_text(r.private_data->'original') e
        where lower(trim(e.key)) ~ '^([0-9]+[[:space:]]*[.):-]?[[:space:]]*)?data[[:space:]]+da[[:space:]]+auditoria$'
        limit 1),'') as raw_date,
      left(coalesce(r.private_data->>'submitted_at',''),10) as reference_date
    from public.audit_responses r
    where (nullif(p_year,'') is null or to_char(r.audit_date,'YYYY')=p_year)
      and (nullif(p_month,'') is null or to_char(r.audit_date,'MM')=p_month)
      and (nullif(p_sector,'') is null or r.sector=p_sector)
      and (nullif(p_shift,'') is null or r.shift=p_shift)
  ), issues as (
    select module,source_row,audit_date,sector,shift,'audit_date'::text field_key,
      raw_date raw_value,reference_date,
      case when audit_date is null then 'invalid_date' else 'date_discrepancy' end issue_type
    from filtered where date_issue is not null
    union all
    select f.module,f.source_row,f.audit_date,f.sector,f.shift,a.key,
      ''::text,f.reference_date,'blank_answer'::text
    from filtered f cross join lateral jsonb_each_text(f.answers) a
    where a.value='vazio'
  ), paged as (
    select * from issues order by module,source_row,field_key
    limit 25 offset (least(greatest(coalesce(p_page,1),1),1000000)-1)*25
  )
  select jsonb_build_object('total',(select count(*) from issues),
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.module,p.source_row,p.field_key) from paged p),'[]'::jsonb))
  into result;
  return result;
end; $$;
revoke all on function public.quality_issues(text,text,text,text,integer) from public, anon;
grant execute on function public.quality_issues(text,text,text,text,integer) to authenticated;
