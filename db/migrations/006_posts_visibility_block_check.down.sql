-- =====================================================================
-- DESTRUCTIVE SECURITY ROLLBACK / MANUAL-ONLY
--
-- 006_posts_visibility_block_check icin geri alma. posts_select
-- policy'sini 001_baseline_schema.sql'deki ORIJINAL (block kontrolu
-- OLMAYAN) haline dondurur. Veri kaybi yok (sadece policy tanimi
-- degisiyor), ama geri alindiktan sonra "acik profil + block" ve
-- "yarisma postu + block" senaryolarinda gorunurluk hatasi GERI GELIR
-- (bkz. [[flicklet_...]] memory - bu migration'in cozdugu tam da bu).
-- Sadece bilincli, tek seferlik bir rollback karari sonrasi elle
-- calistirilmali.
-- =====================================================================

begin;

drop policy if exists "posts_select" on posts;
create policy "posts_select" on posts for select using (
  (contest_category is not null)
  or (exists (
    select 1 from profiles p
    where p.id = posts.author_id
      and (
        p.is_private = false
        or p.id = auth.uid()
        or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.id)
      )
  ))
);

-- anon'un blocked_with EXECUTE yetkisi BILEREK GERI ALINMIYOR - bu saf
-- bir yetki genisletmesiydi (misafir okumasi icin gerekliydi), geri
-- almanin ek bir guvenlik faydasi yok, sadece ileride tekrar ayni
-- soruna yol acar.

commit;
