-- Salt-okunur dogrulama sorgulari - 003.up.sql calistirildiktan sonra elle calistir.

-- Beklenen: proconfig icinde 'search_path=public' gorunmeli.
select p.proname, r.rolname as owner, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_roles r on r.oid = p.proowner
where p.proname = 'handle_new_user';

-- Beklenen: sadece supabase_auth_admin ve postgres satirlari kalmali.
select grantee, privilege_type
from information_schema.routine_privileges
where routine_name = 'handle_new_user'
order by grantee;
