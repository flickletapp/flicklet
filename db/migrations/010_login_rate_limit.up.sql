-- =====================================================================
-- Giris denemeleri icin KALICI ve PAYLASIMLI hiz siniri altyapisi.
--
-- NEDEN: api/login.js'teki ilk surum, sayaci Vercel fonksiyonunun
-- gecici belleginde tutuyordu. Serverless'ta her ornek (instance) kendi
-- bellegine sahip oldugu ve ornekler surekli olusup yok oldugu icin bu
-- sinir kolayca asilabilir. Burada sayac veritabaninda tutuluyor:
-- butun ornekler ayni sayaci gorur, yeniden baslatmalar sayaci sifirlamaz.
--
-- TARAYICI ERISIMI: tablo `private` semasinda. PostgREST varsayilan
-- olarak yalnizca `public` (ve graphql_public) semasini disariya acar,
-- yani bu tabloya tarayicidan HICBIR sekilde (okuma/yazma/silme)
-- erisilemez. Sayaci yoneten fonksiyonlar `public` semasinda ama
-- EXECUTE yetkisi SADECE service_role'da - anon/authenticated
-- cagiramaz.
--
-- GIZLILIK: tabloda ham IP veya kullanici adi TUTULMAZ; sunucudan gelen
-- "ip|kullaniciadi" degerinin SHA-256 ozeti saklanir.
--
-- ATOMIKLIK: sayac artirma + pencere kontrolu tek bir
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING ifadesiyle yapilir;
-- satir kilidi sayesinde es zamanli isteklerde sinir asilmaz.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
-- =====================================================================

begin;

create schema if not exists private;

-- private semasi disariya kapali kalsin.
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.login_attempts (
  key_hash text primary key,
  attempt_count integer not null default 0,
  window_start timestamptz not null default now()
);

revoke all on table private.login_attempts from public;
revoke all on table private.login_attempts from anon;
revoke all on table private.login_attempts from authenticated;

-- Sayaci artirir ve izin verilip verilmedigini doner. TEK ifade =>
-- atomik. p_key sunucudan gelen "ip|normalize-kullanici-adi" degeri;
-- burada hemen ozetlenir, ham hali saklanmaz.
create or replace function public.login_rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_count integer;
  v_window_start timestamptz;
begin
  if p_key is null or p_key = '' then
    -- Anahtar yoksa guvenli tarafta kal: izin verme.
    return query select false, p_window_seconds;
    return;
  end if;

  v_hash := encode(extensions.digest(p_key, 'sha256'), 'hex');

  -- Ara sira eski kayitlari temizle (ucuz, olasiliksal).
  if random() < 0.01 then
    delete from private.login_attempts
    where window_start < now() - interval '1 day';
  end if;

  insert into private.login_attempts as la (key_hash, attempt_count, window_start)
  values (v_hash, 1, now())
  on conflict (key_hash) do update
    set attempt_count = case
          when la.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else la.attempt_count + 1
        end,
        window_start = case
          when la.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else la.window_start
        end
  returning la.attempt_count, la.window_start into v_count, v_window_start;

  if v_count > p_max_attempts then
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds)) - now()))::integer
      );
  else
    return query select true, 0;
  end if;
end;
$$;

-- Basarili giristen sonra sayaci sifirlar.
create or replace function public.login_rate_limit_reset(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or p_key = '' then
    return;
  end if;
  delete from private.login_attempts
  where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
end;
$$;

-- EXECUTE yalnizca service_role'da: tarayici (anon/authenticated) bu
-- fonksiyonlari cagiramaz, dolayisiyla sayaci okuyamaz/sifirlayamaz.
revoke all on function public.login_rate_limit_hit(text, integer, integer) from public;
revoke all on function public.login_rate_limit_hit(text, integer, integer) from anon;
revoke all on function public.login_rate_limit_hit(text, integer, integer) from authenticated;
grant execute on function public.login_rate_limit_hit(text, integer, integer) to service_role;

revoke all on function public.login_rate_limit_reset(text) from public;
revoke all on function public.login_rate_limit_reset(text) from anon;
revoke all on function public.login_rate_limit_reset(text) from authenticated;
grant execute on function public.login_rate_limit_reset(text) to service_role;

commit;
