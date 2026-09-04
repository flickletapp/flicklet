-- =====================================================================
-- api/login.js'in kullanici adiyla giriste e-posta almak icin
-- kullandigi GoTrue Admin API (/auth/v1/admin/users/{id}) cagrisi,
-- staging'de verilen YENI FORMAT Supabase secret key ("sb_secret_...")
-- ile 401 donuyor - GoTrue Admin servisi bu anahtar formatini (henuz)
-- JWT olarak dogrulayamiyor gibi gorunuyor. Ayni anahtarla PostgREST
-- (/rest/v1/...) cagrilari ise SORUNSUZ calisiyor (profiles sorgusu
-- basariyla calisti). Bu yuzden GoTrue Admin API baglantisini tamamen
-- kaldirip, e-postayi da PostgREST uzerinden (RPC ile) almaya geçiyoruz.
--
-- GUVENLIK: fonksiyon SADECE bir uuid alir, o kullanicinin e-postasini
-- doner. EXECUTE yetkisi YALNIZCA service_role'da - anon/authenticated
-- cagiramaz. Cagrilabilmesi icin zaten gecerli bir service-role kimlik
-- dogrulamasi (PostgREST JWT/anahtar dogrulamasi) gerekiyor; yani bunu
-- yalnizca kendi sunucumuz (api/login.js, anahtari tutan taraf)
-- cagirabilir - tarayici hicbir sekilde erisemez.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
-- =====================================================================

begin;

create or replace function public.get_email_for_user_id(p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select email from auth.users where id = p_user_id;
$$;

revoke all on function public.get_email_for_user_id(uuid) from public;
revoke all on function public.get_email_for_user_id(uuid) from anon;
revoke all on function public.get_email_for_user_id(uuid) from authenticated;
grant execute on function public.get_email_for_user_id(uuid) to service_role;

commit;
