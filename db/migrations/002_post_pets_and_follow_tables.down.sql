-- Asama 2 migration'inin geri alma (rollback) betigi.
-- Sadece 002_post_pets_and_follow_tables.up.sql production'a uygulandiktan
-- SONRA bir sorun cikarsa kullanilir. posts.pet_id kolonu up migration'da
-- silinmedigi icin bu rollback veri kaybi olusturmaz.

drop policy if exists "follows_insert" on follows;
create policy "follows_insert" on follows for insert with check (follower_id = auth.uid());

alter table follows drop constraint if exists follows_no_self;

drop table if exists follow_requests;
drop table if exists pet_follows;
drop table if exists post_pets;

-- Not: "alter table pets add column if not exists deleted_at" adimi kasitli
-- olarak geri alinmiyor - bos bir kolonun kalmasi zararsiz; drop column
-- gerekirse ayri, bilinçli bir adimda yapilir.
