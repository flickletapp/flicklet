-- Salt-okunur dogrulama.

select proname, prosecdef, proconfig
from pg_proc
where proname = 'get_email_for_user_id' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: 1 satir, prosecdef=true, proconfig icinde search_path.

select grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'get_email_for_user_id' and routine_schema = 'public';
-- BEKLENEN: anon/authenticated YOK; service_role (ve postgres) var.
