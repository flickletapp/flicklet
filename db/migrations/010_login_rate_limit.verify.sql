-- =====================================================================
-- 010 uygulandiktan SONRA elle calistirilacak dogrulama sorgulari.
-- Hepsi salt-okunur.
-- =====================================================================

-- 1) Tablo private semasinda mi (public'te DEGIL)?
select table_schema, table_name
from information_schema.tables
where table_name = 'login_attempts';
-- BEKLENEN: tek satir, table_schema = 'private'.

-- 2) anon/authenticated'in private semasina veya tabloya yetkisi var mi?
select grantee, privilege_type
from information_schema.table_privileges
where table_name = 'login_attempts' and grantee in ('anon', 'authenticated', 'PUBLIC');
-- BEKLENEN: 0 satir.

-- 3) Fonksiyonlar SECURITY DEFINER ve search_path pinli mi?
select proname, prosecdef, proconfig
from pg_proc
where proname in ('login_rate_limit_hit', 'login_rate_limit_reset')
  and pronamespace = 'public'::regnamespace;
-- BEKLENEN: 2 satir, prosecdef = true, proconfig icinde search_path.

-- 4) EXECUTE yalnizca service_role'da mi?
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_name in ('login_rate_limit_hit', 'login_rate_limit_reset')
  and routine_schema = 'public'
order by routine_name, grantee;
-- BEKLENEN: anon ve authenticated YOK; service_role (ve sahibi postgres) var.
