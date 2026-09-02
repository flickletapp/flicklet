-- Salt-okunur dogrulama sorgulari - 003.up.sql calistirildiktan sonra elle calistir.
-- Tum sorgular tam fonksiyon imzasina ('public.handle_new_user()'::regprocedure)
-- baglidir, isme gore genel arama YAPILMAZ.

-- 1) Fonksiyon metadata: owner, SECURITY DEFINER, search_path.
-- Beklenen: security_definer = true, proconfig icinde 'search_path=' (bos).
select
  p.oid::regprocedure as function_signature,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.oid = 'public.handle_new_user()'::regprocedure;

-- 2a) Yetki matrisi (gercek roller): sadece supabase_auth_admin ve
-- postgres true olmali, anon/authenticated/service_role false olmali.
-- (PUBLIC pseudo-role gercek bir pg_roles satiri degildir, has_function_
-- privilege'a rol adi olarak verilemez - 2b'de ayrica kontrol ediliyor.)
select
  role_name,
  has_function_privilege(role_name, 'public.handle_new_user()'::regprocedure, 'EXECUTE') as can_execute
from unnest(array['supabase_auth_admin', 'postgres', 'anon', 'authenticated', 'service_role']) as role_name
order by role_name;

-- 2b) PUBLIC pseudo-role EXECUTE grant'i var mi? Beklenen: can_execute = false.
select
  'PUBLIC' as role_name,
  exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(p.proacl) as a
    where p.oid = 'public.handle_new_user()'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) as can_execute;

-- 3) auth.users uzerindeki trigger'in varligi ve dogru fonksiyonu cagirdigi.
-- Beklenen: tek satir, function_called = 'public.handle_new_user()'.
select
  t.tgname as trigger_name,
  t.tgrelid::regclass as table_name,
  t.tgenabled as enabled,
  t.tgfoid::regprocedure as function_called
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass
  and t.tgfoid = 'public.handle_new_user()'::regprocedure;
