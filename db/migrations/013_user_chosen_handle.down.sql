-- =====================================================================
-- 013 icin geri alma. handle_new_user() 003'un uyguladigi (search_path
-- pinlenmis, dar yetkili) haline, eski otomatik-uretim mantigiyla
-- birebir geri doner. Case-insensitive index de kaldirilir.
-- =====================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    '@' || lower(split_part(new.email, '@', 1)) || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin, postgres;

drop index if exists public.profiles_handle_lower_unique;

commit;
