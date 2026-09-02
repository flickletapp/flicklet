-- =====================================================================
-- Asama 2 migration'inin geri alma (rollback) betigi.
-- *** SADECE STAGING SUPABASE PROJESINDE CALISTIR. ***
--
-- posts.pet_id kolonu up.sql'de silinmedigi icin bu rollback veri
-- kaybi olusturmaz - post_pets/pet_follows/follow_requests'e sadece
-- migration sonrasi eklenen yeni veri (varsa) kaybolur.
--
-- Idempotent: IF EXISTS deseniyle yazildi, tekrar calistirilirsa hata
-- vermez.
-- =====================================================================

begin;

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
