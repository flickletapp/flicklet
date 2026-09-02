-- =====================================================================
-- 005 migration'i staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur.
-- =====================================================================

-- 1) Fonksiyon metadata: SECURITY DEFINER, search_path bos.
select proname, prosecdef, proconfig
from pg_proc
where proname in ('block_user', 'blocked_with', 'blocked_among');
-- BEKLENEN: uc satir, hepsi prosecdef=true, proconfig icinde search_path="".

-- 2) Yetki matrisi: sadece authenticated calistirabilir.
select
  has_function_privilege('anon', 'public.block_user(uuid)', 'EXECUTE') as anon_block,
  has_function_privilege('authenticated', 'public.block_user(uuid)', 'EXECUTE') as auth_block,
  has_function_privilege('service_role', 'public.block_user(uuid)', 'EXECUTE') as service_block,
  has_function_privilege('anon', 'public.blocked_with(uuid)', 'EXECUTE') as anon_bw,
  has_function_privilege('authenticated', 'public.blocked_with(uuid)', 'EXECUTE') as auth_bw,
  has_function_privilege('anon', 'public.blocked_among(uuid[])', 'EXECUTE') as anon_ba,
  has_function_privilege('authenticated', 'public.blocked_among(uuid[])', 'EXECUTE') as auth_ba;
-- BEKLENEN: anon_*/service_block hepsi false, auth_* hepsi true.

select exists (
  select 1 from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.block_user(uuid)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
) as public_has_execute_block_user;
-- BEKLENEN: false.

-- 3) Kalici test verisi kontrolu (fonksiyonel testler sonrasi calistir).
select
  (select count(*) from public.blocks) as blocks_rows,
  (select count(*) from public.follows) as follows_rows,
  (select count(*) from public.pet_follows) as pet_follows_rows,
  (select count(*) from public.follow_requests) as follow_requests_rows;
-- BEKLENEN: testlerden ONCEKI sayimlarla ayni (rollback sonrasi hepsi 0 olmali).
