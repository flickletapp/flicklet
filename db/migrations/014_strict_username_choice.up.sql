-- =====================================================================
-- 013'teki DAVRANIS HATASINI duzeltir: kullanicinin ACIKCA sectigi
-- kullanici adi cakisirsa veya gecersiz karakter icerirse, trigger
-- SESSIZCE farkli bir ad URETIYORDU (orn. sonuna rastgele ek ekleyerek).
-- Bu YANLIS - kullanici kendi secmedigi bir adla hesap acmamali.
--
-- YENI DAVRANIS:
-- - raw_user_meta_data.handle GONDERILDIYSE: bu deger HICBIR KOSULDA
--   sessizce degistirilmez veya sonuna ek eklenmez.
--     * Gecersiz karakter/uzunluk -> kayit ACIKCA REDDEDILIR (anlasilir
--       dogrulama hatasi, sessiz temizleme YOK).
--     * Cakisma (baskasi ayni adi almis/es zamanli aliyor) -> kayit
--       GUVENLI BICIMDE BASARISIZ OLUR, "Bu kullanıcı adı az önce
--       alındı. Lütfen başka bir kullanıcı adı seç." hatasi.
-- - raw_user_meta_data.handle GONDERILMEDIYSE (OAuth / eski / geriye
--   donuk uyumluluk akislari): SADECE bu durumda otomatik uretim ve
--   (gercekten gerekirse) cakisma varyanti uretme mantigi calisir -
--   burada kullanicinin sectigi bir deger yok, korunmasi gereken bir
--   secim de yok.
--
-- Case-insensitive UNIQUE index (profiles_handle_lower_unique, 013'ten)
-- DEGISMEDEN kaliyor - asil son guvence budur, trigger sadece onun
-- verdigi unique_violation'i anlasilir bir mesaja ceviriyor.
--
-- Mevcut kullanicilarin handle'larina DOKUNULMUYOR.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
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
  v_cleaned text;
  v_handle text;
  v_base text;
  v_auto text;
  v_attempt int := 0;
begin
  v_chosen := new.raw_user_meta_data->>'handle';

  if v_chosen is not null and length(trim(v_chosen)) > 0 then
    -- ==================================================================
    -- Kullanici ACIKCA bir kullanici adi secti. Bu deger BU FONKSIYON
    -- ICINDE ASLA degistirilmez / temizlenip yeniden yazilmaz / sonuna
    -- ek eklenmez. Gecersizse veya cakisirsa kayit basarisiz olur.
    -- ==================================================================
    v_cleaned := regexp_replace(trim(v_chosen), '[^A-Za-z0-9_]', '', 'g');

    if v_cleaned <> trim(v_chosen) or length(v_cleaned) < 3 or length(v_cleaned) > 20 then
      -- Sessizce temizleyip devam ETMIYORUZ - acikca reddediyoruz.
      raise exception using
        errcode = 'FL001',
        message = 'invalid_username',
        detail = 'Kullanıcı adı yalnızca harf, rakam ve alt çizgi (_) içerebilir, 3-20 karakter olmalı.';
    end if;

    v_handle := '@' || v_cleaned;

    begin
      insert into public.profiles (id, handle, display_name)
      values (
        new.id,
        v_handle,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
      );
    exception when unique_violation then
      -- SON GUVENCE burada devreye giriyor: profiles_handle_lower_unique
      -- index'i (013) cakismayi yakaladi. BASKA BIR AD URETMIYORUZ -
      -- kayit acikca basarisiz oluyor.
      raise exception using
        errcode = 'FL002',
        message = 'username_taken',
        detail = 'Bu kullanıcı adı az önce alındı. Lütfen başka bir kullanıcı adı seç.';
    end;

    return new;
  end if;

  -- ==================================================================
  -- Kullanici adi HIC GONDERILMEDI (OAuth / eski / geriye donuk
  -- uyumluluk akisi). Burada korunmasi gereken bir kullanici secimi
  -- YOK - bu yuzden otomatik uretim ve (gercekten es zamanli bir
  -- cakisma olursa) benzersiz varyant uretme mantigi SADECE bu dalda
  -- calisir.
  -- ==================================================================
  v_base := '@' || lower(split_part(new.email, '@', 1)) || substr(new.id::text, 1, 4);
  v_auto := v_base;
  loop
    begin
      insert into public.profiles (id, handle, display_name)
      values (
        new.id,
        v_auto,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
      );
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise;
      end if;
      v_auto := v_base || v_attempt::text;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin, postgres;

commit;
