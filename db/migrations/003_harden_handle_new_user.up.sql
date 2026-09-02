-- =====================================================================
-- Asama 2 audit bulgusu: public.handle_new_user() guvenlik sertlestirme
--
-- *** SADECE STAGING SUPABASE PROJESINDE CALISTIR. ***
-- Bu dosya production'a KARSI CALISTIRILMAMISTIR ve Recep'in acik onayi
-- olmadan calistirilmamalidir (bkz. [[flicklet_branch_workflow]] /
-- [[flicklet_staging_environment]] memory kayitlari).
--
-- Bulgu (001_baseline_schema.sql icindeki nottan): fonksiyon
-- SECURITY DEFINER ama search_path SABIT DEGIL (proconfig = null) ve
-- EXECUTE yetkisi PUBLIC, anon, authenticated, service_role, postgres'e
-- acik. search_path sabitlenmemis SECURITY DEFINER fonksiyonlar,
-- cagiran oturumun search_path'ini kullanir - bir baska rol search_path
-- ilk sirasina yazilabilir bir sema koyup (orn. kendi "public.profiles"
-- adinda bir nesne) fonksiyonu kandirabilir.
--
-- Staging'de dogrulandi (2026-09-02): trigger'i fiilen tetikleyen rol
-- supabase_auth_admin (auth.users INSERT'i o rol yapiyor), ama bu role
-- ayri bir grant YOK - sadece PUBLIC grant'i sayesinde calisabiliyor.
-- Bu yuzden PUBLIC/anon/authenticated/service_role'den REVOKE ederken
-- supabase_auth_admin'e ACIKCA GRANT vermek zorunlu, aksi halde yeni
-- kullanici kaydi (signup) kirilir.
--
-- Tekrar calistirma guvenligi: ALTER FUNCTION ve REVOKE/GRANT
-- idempotent'tir, tekrar calistirilirsa hata vermez.
-- =====================================================================

begin;

alter function public.handle_new_user() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin, postgres;

commit;
