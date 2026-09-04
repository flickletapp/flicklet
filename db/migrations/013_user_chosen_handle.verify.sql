-- Salt-okunur dogrulama.

select indexname, indexdef from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_handle_lower_unique';
-- BEKLENEN: 1 satir, "UNIQUE INDEX ... ON public.profiles USING btree (lower(handle))".

select prosecdef, proconfig from pg_proc
where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: prosecdef=true, proconfig icinde search_path.

select grantee, privilege_type from information_schema.routine_privileges
where routine_name = 'handle_new_user' and routine_schema = 'public';
-- BEKLENEN: sadece supabase_auth_admin ve postgres.
