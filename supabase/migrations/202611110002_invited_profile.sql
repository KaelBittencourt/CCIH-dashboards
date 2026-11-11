-- O Auth pode gravar invited_at depois do INSERT da conta.
-- Completa o perfil leitor já autorizado pelo convite, sem alterar perfis existentes.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invited_at is not null then
    insert into public.profiles(id, role) values (new.id, 'reader')
      on conflict (id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
after update of invited_at on auth.users
for each row when (old.invited_at is null and new.invited_at is not null)
execute function public.create_profile();

insert into public.profiles(id, role)
select id, 'reader' from auth.users where invited_at is not null
on conflict (id) do nothing;
