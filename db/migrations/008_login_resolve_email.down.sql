-- =====================================================================
-- 008 icin geri alma. YIKICI DEGIL - sadece tek bir fonksiyonu kaldirir,
-- veri kaybi soz konusu degil. Yine de elle, bilerek calistirilmali.
-- =====================================================================

begin;

drop function if exists public.login_resolve_email(text, text);

commit;
