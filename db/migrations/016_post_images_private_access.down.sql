-- 016 icin geri alma - SINIRLI kapsam, BILINCLI olarak:
--   - Bucket'i OTOMATIK public YAPMAZ (guvenlik yonu yanlislikla
--     genisletilmesin diye - tekrar public istenirse bu AYRI, acik bir
--     karar olarak elle/ayri bir migration'la yapilmali).
--   - Bucket icindeki hicbir DOSYAYI SILMEZ.
--   - 002. adimdaki eski-URL->path backfill'ini GERI ALMAZ (geri
--     donusturulecek "eski hal" belirsiz olurdu - backfill kalici kabul
--     edilir).
-- Sadece bu migration'in EKLEDIGI policy'leri ve yardimci fonksiyonu
-- kaldirir; bucket satiri (storage.buckets) ve icerigi DOKUNULMADAN kalir.

begin;

drop policy if exists "post_images_write_delete" on storage.objects;
drop policy if exists "post_images_write_update" on storage.objects;
drop policy if exists "post_images_write_insert" on storage.objects;
drop policy if exists "post_images_select" on storage.objects;
drop policy if exists "avatar_images_select" on storage.objects;
drop function if exists public.owns_image_path(text);

commit;
