-- =====================================================================
-- 009 icin "geri alma" - BILINCLI OLARAK BOS BIRAKILDI.
--
-- 009, guvenlik gerekcesiyle kaldirilan bir fonksiyonu siliyor. Bu
-- migration'i geri almak, duz sifreyi tarayicidan Postgres RPC'sine
-- gonderen ve sifre dogrulamasini Supabase Auth disinda yapan GUVENSIZ
-- tasarimi geri getirmek demektir. Bu yuzden burada fonksiyon YENIDEN
-- OLUSTURULMUYOR (fail-safe).
--
-- Gercekten geri almak gerekiyorsa (onerilmez), 008_login_resolve_email.up.sql
-- elle ve bilerek calistirilmalidir.
-- =====================================================================

-- Kasitli olarak islem yok.
select 1;
