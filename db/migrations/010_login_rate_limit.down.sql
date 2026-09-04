-- =====================================================================
-- 010 icin geri alma. Yalnizca hiz siniri altyapisini kaldirir.
-- Veri kaybi riski yok (tablo sadece gecici deneme sayaclarini tutar),
-- ama geri alindiginda giris ucu KALICI hiz sinirindan yoksun kalir -
-- bu yuzden bilerek ve isteyerek calistirilmalidir.
-- =====================================================================

begin;

drop function if exists public.login_rate_limit_reset(text);
drop function if exists public.login_rate_limit_hit(text, integer, integer);
drop table if exists private.login_attempts;
-- Sema baska bir sey icin kullaniliyor olabilir; sadece bosea kaldiysa duser.
drop schema if exists private restrict;

commit;
