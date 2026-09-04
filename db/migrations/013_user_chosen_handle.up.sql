-- =====================================================================
-- Kayit sirasinda kullanicinin ACIKCA sectigi kullanici adini destekler
-- (su ana kadar handle_new_user() e-postanin basindan + rastgele bir
-- ekle OTOMATIK olusturuyordu - kullanici gormeden/secmeden).
--
-- 1) Case-insensitive benzersizlik: mevcut "profiles_handle_key" UNIQUE
--    kisiti CASE-SENSITIVE (ornegin "@Ridvan" ve "@ridvan" ayni anda
--    var olabilirdi). Bu yeni index gercek son guvenceyi sagliyor.
-- 2) handle_new_user(): istemci /auth/v1/signup cagrisinda
--    raw_user_meta_data icinde "handle" gonderdiyse (kullanicinin
--    sectigi kullanici adi, istemci tarafinda zaten dogrulanmis) onu
--    kullanir; gonderilmediyse ESKI otomatik-uretim mantigina aynen
--    geri doner (geriye donuk uyumluluk - mevcut akislari bozmaz).
--    Es zamanli iki kayitta ayni kullanici adi secilirse (istemci
--    tarafi on-kontrol bunu buyuk olcude onler ama garanti etmez)
--    signup BASARISIZ OLMAZ - unique_violation yakalanip benzersiz bir
--    varyant uretilir (SON GUVENCE).
--
-- Mevcut kullanicilarin handle'larina DOKUNULMUYOR - bu fonksiyon
-- sadece YENI kayitlarda calisir.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
-- =====================================================================

begin;

create unique index if not exists profiles_handle_lower_unique on public.profiles (lower(handle));

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
    -- Kullanici adi gonderilmedi/gecersizdi - eski otomatik-uretim
    -- mantigina AYNEN geri don.
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
