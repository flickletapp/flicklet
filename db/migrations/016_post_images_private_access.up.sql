-- =====================================================================
-- post-images bucket'ini PRIVATE yapar, sahiplik + gorunurluk temelli
-- Storage erisim politikalari kurar. Onceki durumda bucket hic
-- yoktu (staging'de "Bucket not found" hatasi) - bu migration hem
-- bucket'i olusturuyor hem de "sadece oturum acmis olmak yeterli"
-- yerine POSTS_SELECT ile BIREBIR AYNI gorunurluk kuralini (sahip /
-- engelli degil / herkese acik profil / onayli takipci / yarisma
-- gonderisi istisnasi) Storage seviyesine tasiyor.
--
-- Yol yapisi (DEGISMEDI, sadece dosya adi semasi degisti - bkz. asagi):
--   Gonderi gorseli : <userId>/<attemptId>.<ext>
--   Avatar          : avatars/<userId>/<attemptId>.<ext>
-- Avatarlar HERKESE ACIK okunabilir kaliyor (profiles tablosunun kendi
-- "using(true)" politikasiyla ayni ilke - gizli bir profilin bile
-- avatari arama/kesfette gorunmeye devam ediyor, mevcut urun davranisi).
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Bucket: private, 10MB, sadece 4 gorsel turu.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- ---------------------------------------------------------------------
-- 2) Eski TAM public URL kayitlarini bare path'e cevir - SADECE bu
-- migration'in calistigi PROJENIN TAM origin'i + bu bucket'in TAM
-- oneki BIREBIR eslesiyorsa. "*.supabase.co" gibi genis bir kalip
-- KULLANILMIYOR - baska bir Supabase projesinin veya dis bir kaynagin
-- (ör. OAuth avatar) URL'si burada YANLISLIKLA bu projenin dosya yolu
-- SAYILMAZ, dokunulmadan kalir. Bucket'in bos olmasi (staging'de 0
-- bucket vardi) kolonlarin da bos oldugunu KANITLAMAZ; bu yuzden bu
-- adim sarti tekrar kontrol ediyor, kosulsuz calismiyor.
--
-- ONEMLI: PROJECT_ORIGIN asagida bu migration'in STAGING (fygaihkirknoyeumcjyp)
-- icin calistirildigi haliyle sabitlenmistir. PRODUCTION'A UYGULANMADAN
-- ONCE bu degeri production'in GERCEK origin'iyle guncelle - aksi halde
-- (zararsiz ama etkisiz sekilde) hicbir satir donusmez.
-- ---------------------------------------------------------------------
do $$
declare
  project_origin text := 'https://fygaihkirknoyeumcjyp.supabase.co';
  legacy_prefix text := project_origin || '/storage/v1/object/public/post-images/';
begin
  -- left(...) = ile BIREBIR (literal) karsilastirma - LIKE joker
  -- karakterlerinin (_, %) yanlislikla yorumlanma riski yok.
  update public.posts
  set image_url = substring(image_url from length(legacy_prefix) + 1)
  where left(image_url, length(legacy_prefix)) = legacy_prefix;

  update public.profiles
  set avatar_url = substring(avatar_url from length(legacy_prefix) + 1)
  where left(avatar_url, length(legacy_prefix)) = legacy_prefix;
end $$;

-- ---------------------------------------------------------------------
-- 3) Sahiplik kontrolu - gonderi VE avatar yol seklini birlikte kapsar.
-- ---------------------------------------------------------------------
create or replace function public.owns_image_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (storage.foldername(object_name))[1] = auth.uid()::text
    or (
      (storage.foldername(object_name))[1] = 'avatars'
      and (storage.foldername(object_name))[2] = auth.uid()::text
    );
$$;

grant execute on function public.owns_image_path(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) SELECT: avatar yollari herkese acik; gonderi yollari posts_select
-- ile AYNI kural (bkz. 006_posts_visibility_block_check.up.sql).
-- ---------------------------------------------------------------------
drop policy if exists "avatar_images_select" on storage.objects;
create policy "avatar_images_select" on storage.objects
for select
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = 'avatars'
);

drop policy if exists "post_images_select" on storage.objects;
create policy "post_images_select" on storage.objects
for select
using (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] <> 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.posts p
      where p.image_url = storage.objects.name
        and not public.blocked_with(p.author_id)
        and (
          p.contest_category is not null
          or exists (
            select 1 from public.profiles pr
            where pr.id = p.author_id
              and (
                pr.is_private = false
                or pr.id = auth.uid()
                or exists (
                  select 1 from public.follows f
                  where f.follower_id = auth.uid() and f.following_id = pr.id
                )
              )
          )
        )
    )
  )
);

-- ---------------------------------------------------------------------
-- 5) INSERT/UPDATE/DELETE: sadece dosya sahibi (owns_image_path).
-- ---------------------------------------------------------------------
drop policy if exists "post_images_write_insert" on storage.objects;
create policy "post_images_write_insert" on storage.objects
for insert
with check (bucket_id = 'post-images' and public.owns_image_path(name));

drop policy if exists "post_images_write_update" on storage.objects;
create policy "post_images_write_update" on storage.objects
for update
using (bucket_id = 'post-images' and public.owns_image_path(name))
with check (bucket_id = 'post-images' and public.owns_image_path(name));

drop policy if exists "post_images_write_delete" on storage.objects;
create policy "post_images_write_delete" on storage.objects
for delete
using (bucket_id = 'post-images' and public.owns_image_path(name));

commit;
