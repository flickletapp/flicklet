-- =====================================================================
-- *** DESTRUCTIVE / MANUEL-ONLY - OTOMATIK CI/CD'DE CALISTIRMA. ***
-- Asama 2 migration'inin geri alma (rollback) betigi.
-- *** SADECE STAGING SUPABASE PROJESINDE CALISTIR. ***
--
-- posts.pet_id kolonu up.sql'de silinmedigi icin TEK PET'li postlar
-- icin veri kaybi olusmaz. AMA: bir posta BIRDEN FAZLA pet eklenmisse
-- (post_pets'te ayni post_id'ye birden fazla satir), bu rollback
-- post_pets tablosunu TAMAMEN SILDIGI icin o fazladan pet baglantilarini
-- geri getirilemez sekilde kaybeder - posts.pet_id zaten tekil bir
-- kolon oldugundan cok-pet verisini geri tasiyacak bir yer yok. Ayni
-- sekilde pet_follows/follow_requests'teki tum veri de kalici olarak
-- silinir. Bu yuzden asagida once bir guvenlik kontrolu var; cok-pet
-- verisi varsa migration REDDEDER, elle inceleme ve Recep onayi gerekir.
--
-- Idempotent (IF EXISTS deseniyle) ama DESTRUCTIVE - sadece bilinçli,
-- tek seferlik bir rollback karari sonrasi elle calistirilmali.
-- =====================================================================

begin;

do $$
declare
  multi_pet_posts integer;
begin
  select count(*) into multi_pet_posts
    from (select post_id from post_pets group by post_id having count(*) > 1) x;
  if multi_pet_posts > 0 then
    raise exception
      'ROLLBACK DURDURULDU: % post''ta birden fazla pet var (post_pets). '
      'posts.pet_id tekil oldugu icin bu veri geri tasinamaz, silinmesi '
      'kalici veri kaybi olur. Elle inceleme ve Recep onayi olmadan devam etme.',
      multi_pet_posts;
  end if;
end $$;

-- DROP FUNCTION, fonksiyonu ve uzerindeki tum GRANT/REVOKE izinlerini
-- birlikte kaldirir; ayrica REVOKE'un IF EXISTS destegi yok.
drop function if exists respond_to_follow_request(uuid, text);

drop policy if exists "follows_insert" on follows;
create policy "follows_insert" on follows for insert with check (follower_id = auth.uid());

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'follows_no_self' and conrelid = 'follows'::regclass
  ) then
    alter table follows drop constraint follows_no_self;
  end if;
end $$;

drop index if exists follow_requests_pending_target_idx;
drop index if exists follow_requests_pending_unique;
drop table if exists follow_requests;

drop index if exists pet_follows_pet_id_idx;
drop table if exists pet_follows;

drop index if exists post_pets_pet_id_idx;
drop table if exists post_pets;

-- Not: "alter table pets add column if not exists deleted_at" adimi
-- kasitli olarak geri alinmiyor - bos bir kolonun kalmasi zararsiz;
-- drop column gerekirse ayri, bilincli bir adimda yapilir.

commit;
