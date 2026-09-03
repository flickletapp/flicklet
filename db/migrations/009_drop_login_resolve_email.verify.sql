-- =====================================================================
-- 009 migration'ini calistirdiktan SONRA elle calistirilacak dogrulama
-- sorgulari. Hepsi salt-okunur.
-- =====================================================================

-- 1) Fonksiyon gercekten silinmis mi?
select proname from pg_proc
where proname = 'login_resolve_email' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: 0 satir.

-- 2) Geride hicbir calistirma izni kalmamis mi?
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'login_resolve_email' and routine_schema = 'public';
-- BEKLENEN: 0 satir.

-- 3) public semasinda auth.users'a dokunan baska bir fonksiyon kalmadi mi
--    (handle_new_user haric - o kayit trigger'i, e-posta dondurmez)?
select p.proname
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and (p.prosrc ilike '%encrypted_password%' or p.prosrc ilike '%auth.users%');
-- BEKLENEN: sadece handle_new_user (veya hic satir).
