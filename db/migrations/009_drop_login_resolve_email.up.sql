-- =====================================================================
-- 008'de eklenen public.login_resolve_email fonksiyonunu KALDIRIR.
--
-- NEDEN KALDIRILIYOR (guvenlik gerekcesi):
-- 008'deki tasarim, kullanici adiyla giris icin duz sifreyi tarayicidan
-- dogrudan bir Postgres RPC'sine gonderiyor ve sifre dogrulamasini
-- Supabase Auth'un DISINDA, elle (extensions.crypt ile
-- auth.users.encrypted_password'e karsi) yapiyordu. Sorunlar:
--   1. Duz sifre, Auth uclari yerine veritabani RPC'sine gidiyordu.
--   2. Sifre dogrulama Supabase Auth disinda ikinci bir yerde yapiliyordu.
--   3. Supabase Auth giris uclarindaki hiz sinirlama / kotuye kullanim
--      korumalari bu ilk adimi KAPSAMIYORDU (anon anahtarla sinirsiz
--      deneme yapilabilirdi).
--   4. auth.users.encrypted_password'e ozel bir fonksiyonla erisiliyordu.
--   5. Fonksiyon, dogru sifre durumunda e-posta donduruyordu.
--
-- Yerine gecen tasarim: sunucu tarafi giris katmani (Vercel Serverless
-- Function, `api/login.js`). Kullanici adi -> hesap eslemesi yalnizca
-- sunucuda, service-role anahtariyla yapilir; kimlik dogrulama ise
-- her zaman Supabase Auth'un kendi /auth/v1/token ucundan gecer.
-- Boylece sifre asla veritabani RPC'sine gitmez ve Auth'un hiz
-- sinirlari tum sifre denemelerini kapsar.
--
-- 008 migration DOSYASI GECMISI BOZMAMAK ICIN DEGISTIRILMEDI; bu ileri
-- yonlu (forward) migration onu geri alir.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'DA
-- CALISTIRILMADI - zaten 008 de production'a hic uygulanmamisti.
-- =====================================================================

begin;

-- Once tum calistirma izinlerini geri al (fonksiyon bir sebeple
-- silinemezse bile disaridan cagrilamaz kalsin).
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'login_resolve_email' and pronamespace = 'public'::regnamespace
  ) then
    revoke all on function public.login_resolve_email(text, text) from public;
    revoke all on function public.login_resolve_email(text, text) from anon;
    revoke all on function public.login_resolve_email(text, text) from authenticated;
    revoke all on function public.login_resolve_email(text, text) from service_role;
  end if;
end $$;

drop function if exists public.login_resolve_email(text, text);

commit;
