-- =====================================================================
-- 006 migration'i staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur.
-- =====================================================================

-- 1) posts_select policy tanimi block kontrolu iceriyor mu?
select policyname, qual from pg_policies where tablename = 'posts' and cmd = 'SELECT';
-- BEKLENEN: qual icinde "blocked_with" geciyor.

-- 2) blocked_with anon icin de calistirilabilir mi (misafir Akis/Kesfet
-- icin gerekli)?
select
  has_function_privilege('anon', 'public.blocked_with(uuid)', 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', 'public.blocked_with(uuid)', 'EXECUTE') as auth_exec;
-- BEKLENEN: ikisi de true.

-- 3) Kalici test verisi kontrolu (fonksiyonel testler sonrasi calistir).
select
  (select count(*) from public.posts) as posts_rows,
  (select count(*) from public.blocks) as blocks_rows,
  (select count(*) from public.profiles) as profiles_rows;
-- BEKLENEN: testlerden ONCEKI sayimlarla ayni (rollback sonrasi hepsi
-- staging'in mevcut organik verisiyle ayni olmali, sifirlanmis olmamali).
