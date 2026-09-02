-- =====================================================================
-- SECURITY ROLLBACK / MANUAL-ONLY
--
-- 003_harden_handle_new_user icin geri alma. Bu dosya handle_new_user()
-- fonksiyonunu KASITLI OLARAK ESKI, GENIS YETKILI ve search_path'i
-- SABITLENMEMIS haline geri dondurur (PUBLIC/anon/authenticated/
-- service_role'e tekrar EXECUTE verir, search_path korumasini kaldirir).
-- Bu YALNIZCA elle, bilincli bir karar sonucu calistirilmalidir - hicbir
-- otomatik/CI rollback akisinin parcasi OLMAMALIDIR. SADECE STAGING'de
-- test amacli calistirildi; production'a bu dosya hicbir kosulda
-- otomatik uygulanmamalidir.
-- =====================================================================

begin;

alter function public.handle_new_user() reset search_path;

revoke execute on function public.handle_new_user() from supabase_auth_admin;
grant execute on function public.handle_new_user() to public, anon, authenticated, service_role, postgres;

commit;
