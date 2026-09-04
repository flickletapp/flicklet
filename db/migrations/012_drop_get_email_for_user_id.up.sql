-- =====================================================================
-- 011'de eklenen public.get_email_for_user_id fonksiyonunu kaldirir.
--
-- NEDEN: api/login.js artik e-postayi resmi Supabase Admin API'siyle
-- (auth.admin.getUserById(), sunucu tarafinda, supabase-js SDK ile)
-- aliyor - ozel bir SQL/RPC fonksiyonuna artik gerek yok. Bu fonksiyon
-- kullanilmiyor, yuzey alanini gereksiz yere buyutuyor.
--
-- 011 migration DOSYASI GECMISI BOZMAMAK ICIN DEGISTIRILMEDI; bu ileri
-- yonlu (forward) migration onu geri alir - 009'daki desenle ayni.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI
-- (011 zaten hic production'a uygulanmamisti).
-- =====================================================================

begin;

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'get_email_for_user_id' and pronamespace = 'public'::regnamespace
  ) then
    revoke all on function public.get_email_for_user_id(uuid) from public;
    revoke all on function public.get_email_for_user_id(uuid) from anon;
    revoke all on function public.get_email_for_user_id(uuid) from authenticated;
    revoke all on function public.get_email_for_user_id(uuid) from service_role;
  end if;
end $$;

drop function if exists public.get_email_for_user_id(uuid);

commit;
