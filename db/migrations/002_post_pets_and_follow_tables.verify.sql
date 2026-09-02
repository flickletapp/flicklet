-- =====================================================================
-- 002 migration'i staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur (SELECT) - veri degistirmez.
-- Beklenen sonuc her sorgunun yanindaki yorumda yazili; farkli bir
-- sonuc cikarsa migration'a devam etme, once nedenini arastir.
-- =====================================================================

-- 1) Tasinan kayit sayisi: posts.pet_id dolu olan satir sayisi ile
-- post_pets'e tasinan (distinct post_id) satir sayisi esit olmali.
select
  (select count(*) from posts where pet_id is not null) as posts_with_pet_id,
  (select count(distinct post_id) from post_pets) as post_pets_distinct_posts;
-- BEKLENEN: iki sayi esit.

-- 2) Orphan kontrolu: post_pets'te olup posts/pets tarafinda karsiligi
-- olmayan satir olmamali (FK zaten bunu engeller ama emin olmak icin).
select count(*) as orphan_post_pets
from post_pets pp
where not exists (select 1 from posts p where p.id = pp.post_id)
   or not exists (select 1 from pets pt where pt.id = pp.pet_id);
-- BEKLENEN: 0

-- 2b) posts.pet_id dolu olup post_pets'te KARSILIGI OLMAYAN satir
-- (migration'in insert...on conflict adimi atlamis olabilir mi?).
select p.id, p.pet_id
from posts p
where p.pet_id is not null
  and not exists (
    select 1 from post_pets pp where pp.post_id = p.id and pp.pet_id = p.pet_id
  );
-- BEKLENEN: 0 satir.

-- 3) Kendi kendini takip (self-follow) kalmis mi?
select count(*) as self_follow_count from follows where follower_id = following_id;
-- BEKLENEN: 0 (constraint zaten DB seviyesinde engeller, bu ekstra kontrol)

-- 4) Bloklu iken devam eden takipler (constraint SADECE yeni INSERT'leri
-- engeller - migration ONCESINDEN kalma satirlar varsa burada cikar).
select f.follower_id, f.following_id
from follows f
where exists (select 1 from blocks b where b.blocker_id = f.following_id and b.blocked_id = f.follower_id)
   or exists (select 1 from blocks b where b.blocker_id = f.follower_id and b.blocked_id = f.following_id);
-- BEKLENEN: 0 satir. Satir cikarsa bu ONCEDEN VAR OLAN veridir, migration
-- otomatik silmez - Recep'e sorulmadan temizlenmemeli.

-- 5) follow_requests kismi unique index dogru calisiyor mu: ayni
-- (requester_id, target_id) icin birden fazla 'pending' satir olmamali.
select requester_id, target_id, count(*)
from follow_requests
where status = 'pending'
group by requester_id, target_id
having count(*) > 1;
-- BEKLENEN: 0 satir.

-- 6) respond_to_follow_request fonksiyonu var mi ve beklenen sahiplige
-- (security definer) sahip mi?
select proname, prosecdef, proconfig
from pg_proc
where proname = 'respond_to_follow_request';
-- BEKLENEN: 1 satir, prosecdef = true, proconfig icinde 'search_path=public'.

-- 7) RLS acik mi (enable row level security calisti mi)?
select relname, relrowsecurity
from pg_class
where relname in ('post_pets', 'pet_follows', 'follow_requests');
-- BEKLENEN: uc satir da relrowsecurity = true.

-- 8) Manuel RLS yetki testi (staging'de gercek bir test kullanicisinin
-- uid'siyle - psql/SQL Editor'de su sekilde bir kullaniciyi simule
-- edebilirsin, sadece staging'de kullan):
--
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub', '<test-user-uuid>')::text, true);
--   select * from post_pets;       -- sadece gorebildigi post'lara ait satirlar donmeli
--   select * from pet_follows;     -- kendi petini takip eden bir satir olusturmaya calis, reddedilmeli
--   select * from follow_requests; -- sadece kendi gonderdigi/aldigi istekler gorunmeli
--
-- Bu blok otomatik calistirilmaz, elle staging'de denenmeli.
