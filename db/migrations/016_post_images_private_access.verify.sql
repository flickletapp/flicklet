-- Salt-okunur dogrulama.

select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'post-images';
-- BEKLENEN: 1 satir, public=false, file_size_limit=10485760, 4 mime turu.

select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
-- BEKLENEN: avatar_images_select, post_images_select, post_images_write_delete,
-- post_images_write_insert, post_images_write_update.

select prosecdef, proconfig from pg_proc where proname='owns_image_path' and pronamespace='public'::regnamespace;
-- BEKLENEN: 1 satir, search_path pinli.

-- Backfill'in ETKISINI goster - bos donmesi "hicbir seyin donusmedigi"
-- anlamina gelmez, sadece bu PROJENIN TAM legacy oneki ile eslesen satir
-- kalmadigini gosterir (bkz. up.sql'deki project_origin degeri - PRODUCTION'da
-- farkli olacagindan bu kontrolu de o degerle guncelle).
select count(*) as posts_with_legacy_url_before_check
from public.posts
where left(image_url, length('https://fygaihkirknoyeumcjyp.supabase.co/storage/v1/object/public/post-images/'))
    = 'https://fygaihkirknoyeumcjyp.supabase.co/storage/v1/object/public/post-images/';
-- BEKLENEN: 0 (migration'dan SONRA calistirilirsa - donusum zaten uygulanmis olmali).

select id, image_url from public.posts where image_url is not null;
select id, avatar_url from public.profiles where avatar_url is not null;
-- Bu iki sorgu gercek deger turlerini GOSTERIR - bos bucket varsayimina
-- degil, gercek kolon icerigine bakilmis olur.
