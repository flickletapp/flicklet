-- =====================================================================
-- 003_harden_handle_new_user icin geri alma - production'daki eski
-- (sertlestirilmemis) haline doner. SADECE STAGING'de test icin.
-- =====================================================================

begin;

alter function public.handle_new_user() reset search_path;

revoke execute on function public.handle_new_user() from supabase_auth_admin;
grant execute on function public.handle_new_user() to public, anon, authenticated, service_role, postgres;

commit;
