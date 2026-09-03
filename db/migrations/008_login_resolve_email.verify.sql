-- =====================================================================
-- 008 migration'ini staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur (fonksiyonu cagirmiyor).
-- =====================================================================

-- 1) Fonksiyon var mi, SECURITY DEFINER mi, search_path pinlenmis mi?
select proname, prosecdef, proconfig
from pg_proc
where proname = 'login_resolve_email' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: 1 satir, prosecdef=true, proconfig icinde 'search_path='.

-- 2) EXECUTE yetkisi sadece anon/authenticated'e mi verilmis (PUBLIC'e
--    DEGIL)?
select grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'login_resolve_email' and routine_schema = 'public'
order by grantee;
-- BEKLENEN: sadece anon ve authenticated satirlari, PUBLIC yok.
