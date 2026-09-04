-- =====================================================================
-- 014 icin geri alma. handle_new_user() 013'un (kullanici sectiginde
-- cakismada sessizce varyant ureten) haline geri doner.
-- =====================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chosen text;
  v_base text;
  v_handle text;
  v_attempt int := 0;
begin
  v_chosen := new.raw_user_meta_data->>'handle';
  if v_chosen is not null and length(regexp_replace(trim(v_chosen), '[^a-zA-Z0-9_]', '', 'g')) >= 2 then
    v_base := '@' || regexp_replace(trim(v_chosen), '[^a-zA-Z0-9_]', '', 'g');
  else
    v_base := '@' || lower(split_part(new.email, '@', 1)) || substr(new.id::text, 1, 4);
  end if;

  v_handle := v_base;
  loop
    begin
      insert into public.profiles (id, handle, display_name)
      values (
        new.id,
        v_handle,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
      );
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise;
      end if;
      v_handle := v_base || substr(new.id::text, 1, 4) || v_attempt::text;
    end;
  end loop;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin, postgres;

commit;
