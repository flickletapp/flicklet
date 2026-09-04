-- Salt-okunur dogrulama.

select tgname, tgenabled from pg_trigger
where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_handle_format_guard';
-- BEKLENEN: 1 satir, tgenabled='O' (etkin).

select prosecdef, proconfig from pg_proc
where proname = 'enforce_profiles_handle_format' and pronamespace = 'public'::regnamespace;
-- BEKLENEN: prosecdef=false (SECURITY INVOKER), proconfig icinde search_path.

-- 013/014'ten kalan korumalarin hala yerinde oldugunu dogrula.
select indexname from pg_indexes
where tablename = 'profiles' and indexname = 'profiles_handle_lower_unique';
-- BEKLENEN: 1 satir.

-- Mevcut gecersiz satirin DOKUNULMADIGINI dogrula.
select id, handle from public.profiles where handle = '@byrecko34%*/2ş';
-- BEKLENEN: 1 satir, deger degismemis.
