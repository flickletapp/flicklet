-- =====================================================================
-- 004 migration'i staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur (SELECT) - veri degistirmez.
-- Tum sorgular tam fonksiyon imzasina baglidir, isme gore genel arama
-- YAPILMAZ.
-- =====================================================================

-- 1) Guard fonksiyonlarinin metadata'si: owner, SECURITY DEFINER,
-- search_path. Beklenen: uc satir da security_definer=true,
-- proconfig icinde 'search_path=' (bos), owner tutarli (postgres).
select
  p.oid::regprocedure as function_signature,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.oid in (
  'public.guard_follows_insert()'::regprocedure,
  'public.guard_pet_follows_insert()'::regprocedure,
  'public.guard_follow_requests_insert()'::regprocedure
)
order by function_signature;

-- 2) respond_to_follow_request search_path guncellemesi. Beklenen:
-- proconfig icinde 'search_path=' (bos, artik 'search_path=public' degil).
select
  p.oid::regprocedure as function_signature,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.oid = 'public.respond_to_follow_request(uuid,text)'::regprocedure;

-- 3) Guard fonksiyonlarinin yetki matrisi: PUBLIC/anon/authenticated/
-- service_role hepsi false olmali (postgres haric - owner oldugu icin
-- implicit erisimi var, ayrica kontrol edilmiyor).
select
  fn.function_signature,
  role_name,
  has_function_privilege(role_name, fn.function_signature, 'EXECUTE') as can_execute
from (values
  ('public.guard_follows_insert()'::regprocedure),
  ('public.guard_pet_follows_insert()'::regprocedure),
  ('public.guard_follow_requests_insert()'::regprocedure)
) as fn(function_signature)
cross join unnest(array['anon', 'authenticated', 'service_role']) as role_name
order by fn.function_signature, role_name;

-- 3b) PUBLIC pseudo-role EXECUTE grant'i var mi (guard fonksiyonlari icin)?
-- Beklenen: hepsi can_execute = false.
select
  p.oid::regprocedure as function_signature,
  exists (
    select 1 from aclexplode(p.proacl) as a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_can_execute
from pg_proc p
where p.oid in (
  'public.guard_follows_insert()'::regprocedure,
  'public.guard_pet_follows_insert()'::regprocedure,
  'public.guard_follow_requests_insert()'::regprocedure
)
order by function_signature;

-- 4) Trigger'larin varligi ve dogru fonksiyonu cagirdigi.
-- Beklenen: uc satir, her biri enabled='O' ve dogru function_called.
select
  t.tgname as trigger_name,
  t.tgrelid::regclass as table_name,
  t.tgenabled as enabled,
  t.tgfoid::regprocedure as function_called
from pg_trigger t
where t.tgname in ('follows_insert_guard', 'pet_follows_insert_guard', 'follow_requests_insert_guard')
order by trigger_name;

-- 5) blocks tablosunun SELECT RLS policy'si DEGISMEDI mi? Beklenen:
-- tek satir, qual = '(auth.uid() = blocker_id)' (004 oncesiyle ayni).
select policyname, cmd, qual
from pg_policies
where tablename = 'blocks' and cmd = 'SELECT';

-- =====================================================================
-- ASAGISI BU REVIZYONDA EKLENDI (kapali profil/pet icin follow_requests
-- akisi, pet_id kolonu, sadelesmis RLS, genisletilmis yetki matrisi).
-- =====================================================================

-- 6) pet_id kolonu: nullable uuid, pets(id) on delete cascade FK'si.
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'follow_requests' and column_name = 'pet_id';
-- BEKLENEN: 1 satir, is_nullable = YES, data_type = uuid.

select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.follow_requests'::regclass and contype = 'f' and conname like '%pet_id%';
-- BEKLENEN: 1 satir, "FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE".

-- 7) Eski tekil pending index kalkti mi, iki yeni partial index dogru mu?
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'follow_requests' and indexname like 'follow_requests_pending%';
-- BEKLENEN: follow_requests_pending_unique SATIRI YOK; sadece
-- follow_requests_pending_human_unique (requester_id, target_id) WHERE
-- status='pending' AND pet_id IS NULL; ve follow_requests_pending_pet_unique
-- (requester_id, pet_id) WHERE status='pending' AND pet_id IS NOT NULL.

-- 8) respond_to_follow_request icin GENISLETILMIS yetki matrisi -
-- service_role ve supabase_auth_admin de ARTIK false olmali (onceki
-- turda service_role=true platform default'tan geliyordu, bu revizyonda
-- acikca kapatildi).
select
  has_function_privilege('anon', 'public.respond_to_follow_request(uuid,text)', 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', 'public.respond_to_follow_request(uuid,text)', 'EXECUTE') as authenticated_exec,
  has_function_privilege('service_role', 'public.respond_to_follow_request(uuid,text)', 'EXECUTE') as service_role_exec,
  has_function_privilege('supabase_auth_admin', 'public.respond_to_follow_request(uuid,text)', 'EXECUTE') as auth_admin_exec;
-- BEKLENEN: anon_exec=false, authenticated_exec=true, service_role_exec=false, auth_admin_exec=false.

select exists (
  select 1 from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.respond_to_follow_request(uuid,text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
) as public_has_execute;
-- BEKLENEN: false.

-- 9) RLS INSERT policy'leri artik SADECE kimlik kontrolu iceriyor mu
-- (blocks/pets alt sorgusu kalmamali)?
select tablename, policyname, with_check
from pg_policies
where tablename in ('follows', 'pet_follows', 'follow_requests') and cmd = 'INSERT';
-- BEKLENEN: follows_insert -> "(follower_id = auth.uid())"
--           pet_follows_insert -> "(follower_id = auth.uid())"
--           follow_requests_insert -> "(requester_id = auth.uid())"
-- Ucunde de "blocks" veya "pets" gecmemeli.

-- 10) Kalici test verisi kontrolu (fonksiyonel testler sonrasi calistir).
select
  (select count(*) from public.follow_requests) as follow_requests_rows,
  (select count(*) from public.follows) as follows_rows,
  (select count(*) from public.pet_follows) as pet_follows_rows,
  (select count(*) from public.pets) as pets_rows,
  (select count(*) from public.profiles) as profiles_rows,
  (select count(*) from public.blocks) as blocks_rows;
-- BEKLENEN: testlerden ONCEKI sayimlarla birebir ayni (hepsi migration
-- sonrasi, test oncesi 0 ise test sonrasi da 0 olmali).
