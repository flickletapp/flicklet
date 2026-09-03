-- =====================================================================
-- Asama 2 duzeltme migration'i: posts_select RLS'ine iki yonlu engel
-- kontrolu eklenmesi.
--
-- ONCE STAGING'DE DOGRULANACAK (ref: fygaihkirknoyeumcjyp); PRODUCTION'DA
-- YALNIZCA RECEP'IN AYRICA VERECEGI ACIK ONAYDAN SONRA CALISTIRILABILIR.
--
-- KOK NEDEN (dogrulandi - staging'de gercek kullanicilarla test edilen
-- senaryo): production/baseline'dan gelen `posts_select` policy'si
-- (001_baseline_schema.sql) HICBIR SEKILDE `blocks` tablosuna bakmiyordu:
--
--   (contest_category IS NOT NULL) OR (EXISTS (
--     SELECT 1 FROM profiles p WHERE p.id = posts.author_id AND (
--       p.is_private = false OR p.id = auth.uid() OR EXISTS (
--         SELECT 1 FROM follows f WHERE f.follower_id=auth.uid() AND f.following_id=p.id
--       )
--     )
--   ))
--
-- Yani: (a) yazarin profili ACIKSA (p.is_private=false), block'a
-- BAKILMAKSIZIN post herkese gorunuyordu - bu, "felah385 rturkoglu034'u
-- blockladi ama rturkoglu034'un (acik profil) gonderisi hala Akis'ta
-- gorunuyor" hatasinin BIREBIR kok nedeni. (b) yarisma postlari
-- (contest_category IS NOT NULL) HER ZAMAN gorunuyordu, gizlilik VE
-- block'tan tamamen bagimsiz - bu da engelin yarisma listelerinde de
-- gecerli olmasi gerektigi icin ayrica duzeltilmesi gereken bir durumdu.
--
-- Feed.jsx/Discover.jsx/Contest.jsx UCU DE ayni `posts` tablosunu
-- sorguluyor - tek bir RLS duzeltmesi HEPSINI kapsiyor (ayri ayri
-- istemci kodu degistirmeye gerek yok, guvenligin tek kaynagi burasi).
--
-- COZUM: 005'teki `blocked_with(other_user_id)` (SECURITY DEFINER, iki
-- yonlu, RLS'in tek basina gosteremedigi yonu de kapsayan) fonksiyonunu
-- policy'nin EN BASINA, TUM govdeyi kapsayacak sekilde `AND NOT
-- blocked_with(author_id)` olarak ekliyoruz - boylece engel, contest
-- istisnasi dahil TUM gorunurluk kurallarinin USTUNDE.
--
-- Kendi gonderilerim etkilenmiyor: block_user() kendine block atmayi
-- zaten reddediyor (005), yani blocked_with(auth.uid()) hicbir zaman
-- true donmez.
-- =====================================================================

begin;

-- blocked_with, artik posts_select RLS'i icinde TUM sorgulayan roller
-- (anon/misafir dahil) tarafindan degerlendirilecek - policy ifadesi
-- cagiran rolun EXECUTE yetkisini gerektiriyor. Misafir/anon icin
-- auth.uid() = null oldugundan fonksiyon guvenle her zaman false doner
-- (hicbir block satiri null ile eslesmez) - misafir akisini bozmaz.
grant execute on function public.blocked_with(uuid) to anon;

drop policy if exists "posts_select" on posts;
create policy "posts_select" on posts for select using (
  not public.blocked_with(author_id)
  and (
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
  )
);

commit;
