-- Salt-okunur dogrulama.

select prosecdef, proconfig from pg_proc
where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: prosecdef=true, proconfig icinde search_path.

select grantee from information_schema.routine_privileges
where routine_name = 'handle_new_user' and routine_schema = 'public';
-- BEKLENEN: sadece supabase_auth_admin ve postgres.

select indexname from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_handle_lower_unique';
-- BEKLENEN: 1 satir (013'ten degismedi).
