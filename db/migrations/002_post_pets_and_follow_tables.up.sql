-- =====================================================================
-- Asama 2 migration: post_pets + pet_follows + follow_requests + kurallar
--
-- *** SADECE STAGING SUPABASE PROJESINDE CALISTIR. ***
-- Bu dosya production'a KARSI CALISTIRILMAMISTIR ve Recep'in acik onayi
-- olmadan calistirilmamalidir (bkz. [[flicklet_branch_workflow]] /
-- [[flicklet_staging_environment]] memory kayitlari).
--
-- Geriye donukluk: posts.pet_id kolonu bu migration'da SILINMIYOR.
-- Uygulama kodu post_pets'e tasindiktan ve staging'de dogrulandiktan
-- SONRA, ayri bir migration'da (003_drop_posts_pet_id.sql) kaldirilacak.
-- Bu arada kod, gecici olarak hem eski hem yeni yapiyla calisabilir
-- olmali (CreatePost.jsx her iki alana da yazmali) - bu SQL dosyasinin
-- degil, ayri bir kod degisikliginin konusu.
--
-- Tekrar calistirma guvenligi: script CREATE ... IF NOT EXISTS ve
-- DROP POLICY IF EXISTS / DROP INDEX IF EXISTS deseniyle yazildi, yani
-- basarili sekilde tamamlanmis bir calistirmadan sonra tekrar
-- calistirilirsa hata vermez (no-op). Yine de normal akis: staging'de
-- SADECE BIR KEZ calistirilmasi beklenir.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 1: post_pets baglanti tablosu (posts.pet_id'nin yerini alacak,
-- cok pet destegi icin). Mevcut posts.pet_id verisi buraya taşınır ama
-- kolon silinmez (yukarki notu bkz.).
-- ---------------------------------------------------------------------
create table if not exists post_pets (
  post_id uuid not null references posts(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, pet_id)
);
alter table post_pets enable row level security;

drop policy if exists "post_pets_select" on post_pets;
-- Bir post_pets satirini gorebilme yetkisi, dogrudan bagli oldugu
-- post'un gorunurluguyle ayni olmali. Kosulsuz `using (true)` KULLANMIYORUZ.
-- Alt sorgudaki `posts` tablosu, cagiran kullanicinin oturumu altinda
-- calisir (SECURITY DEFINER degiliz), yani posts'un KENDI posts_select
-- RLS politikasi bu EXISTS icinde otomatik olarak uygulanir. Bu, iki
-- yerde ayni gorunurluk mantigini kopyalayip zamanla birbirinden
-- sapmasindan (drift) daha guvenli.
create policy "post_pets_select" on post_pets for select using (
  exists (select 1 from posts p where p.id = post_pets.post_id)
);

drop policy if exists "post_pets_insert" on post_pets;
create policy "post_pets_insert" on post_pets for insert with check (
  exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid())
);

drop policy if exists "post_pets_delete" on post_pets;
create policy "post_pets_delete" on post_pets for delete using (
  exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid())
);

-- Mevcut posts.pet_id verisini post_pets'e tasi (idempotent: ayni
-- (post_id, pet_id) ciftini tekrar eklemeye calismaz).
insert into post_pets (post_id, pet_id)
  select id, pet_id from posts
  where pet_id is not null
  on conflict (post_id, pet_id) do nothing;

create index if not exists post_pets_pet_id_idx on post_pets (pet_id);


-- ---------------------------------------------------------------------
-- STEP 2: pet_follows (bagimsiz pet takibi). Kullanim UI'i Asama 7'de
-- gelecek, sema simdiden hazirlaniyor.
--
-- URUN KARARI (Recep onayina acik, degistirmesi kolay): bir kullanici
-- KENDI petini takip edemez - takip, baskasinin icerigini abone olarak
-- izlemek icindir; kendi petini "takip etmek" anlamsiz ve UI'da
-- kafa karistirici sayilar uretir (orn. "1 takipcin var: sen").
-- Bu yuzden asagidaki insert policy'de owner_id = auth.uid() durumu
-- ayrica reddediliyor.
-- ---------------------------------------------------------------------
create table if not exists pet_follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, pet_id)
);
alter table pet_follows enable row level security;

drop policy if exists "pet_follows_select" on pet_follows;
create policy "pet_follows_select" on pet_follows for select using (true);

drop policy if exists "pet_follows_insert" on pet_follows;
create policy "pet_follows_insert" on pet_follows for insert with check (
  follower_id = auth.uid()
  and not exists (
    -- kendi petini takip etme (urun karari, yukariki notu bkz.)
    select 1 from pets pt where pt.id = pet_id and pt.owner_id = auth.uid()
  )
  and not exists (
    -- iki yonlu engelleme kontrolu: pet sahibi beni engellemis OLABILIR
    -- ya da ben pet sahibini engellemis olabilirim, her iki durumda da
    -- takip engellenir.
    select 1 from pets pt
    where pt.id = pet_id
      and (
        exists (select 1 from blocks b where b.blocker_id = pt.owner_id and b.blocked_id = auth.uid())
        or exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = pt.owner_id)
      )
  )
);

drop policy if exists "pet_follows_delete" on pet_follows;
create policy "pet_follows_delete" on pet_follows for delete using (follower_id = auth.uid());

create index if not exists pet_follows_pet_id_idx on pet_follows (pet_id);


-- ---------------------------------------------------------------------
-- STEP 3: follow_requests (kapali profile takip onayi). Kullanim UI'i
-- Asama 7'de gelecek, sema simdiden hazirlaniyor.
--
-- Genel bir UPDATE policy TANIMLANMIYOR (bilincli): status'u
-- degistirmek kimlik alanlarinin (requester_id/target_id) degismesine
-- veya gecersiz durum gecislerine (orn. accepted -> pending) acik kapi
-- birakir. Bunun yerine STEP 4'teki respond_to_follow_request() RPC
-- fonksiyonu, kabul/red islemini dogrulayarak ve accepted durumda
-- follows kaydini AYNI transaction icinde olusturarak yapar.
-- ---------------------------------------------------------------------
create table if not exists follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
alter table follow_requests enable row level security;

-- Tum durumlari kapsayan tekil UNIQUE constraint YERINE, sadece aktif
-- (pending) istekleri tekillestiren kismi (partial) unique index:
-- reddedilmis/iptal edilmis (silinmis) bir istekten sonra ayni kisiye
-- yeniden istek gonderilebilsin diye.
drop index if exists follow_requests_pending_unique;
create unique index follow_requests_pending_unique
  on follow_requests (requester_id, target_id)
  where status = 'pending';

drop policy if exists "follow_requests_select" on follow_requests;
create policy "follow_requests_select" on follow_requests for select using (
  requester_id = auth.uid() or target_id = auth.uid()
);

drop policy if exists "follow_requests_insert" on follow_requests;
create policy "follow_requests_insert" on follow_requests for insert with check (
  requester_id = auth.uid()
  and requester_id <> target_id
  and not exists (select 1 from blocks b where b.blocker_id = target_id and b.blocked_id = requester_id)
  and not exists (select 1 from blocks b where b.blocker_id = requester_id and b.blocked_id = target_id)
  and not exists (select 1 from follows f where f.follower_id = requester_id and f.following_id = target_id)
);

-- Istegi gonderen kisi, hala pending durumdaysa iptal edebilir (silerek).
-- Silinen bir istek, partial unique index'i bosaltir - ayni kisiye
-- yeniden istek gonderilebilir hale gelir.
drop policy if exists "follow_requests_delete" on follow_requests;
create policy "follow_requests_delete" on follow_requests for delete using (
  requester_id = auth.uid() and status = 'pending'
);

create index if not exists follow_requests_pending_target_idx
  on follow_requests (target_id)
  where status = 'pending';


-- ---------------------------------------------------------------------
-- STEP 4: follow_requests'i kabul/red eden guvenli RPC fonksiyonu.
-- SECURITY DEFINER + sabit search_path (arama yolu ele gecirme
-- saldirisina karsi standart onlem). Sadece target_id = cagiran
-- kullanici olan, hala 'pending' olan istekleri isler; kabul edilirse
-- follows kaydini AYNI transaction icinde olusturur.
-- ---------------------------------------------------------------------
create or replace function respond_to_follow_request(request_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req follow_requests%rowtype;
begin
  if new_status not in ('accepted', 'rejected') then
    raise exception 'gecersiz durum: % (sadece accepted/rejected kabul edilir)', new_status;
  end if;

  select * into req from follow_requests where id = request_id for update;
  if not found then
    raise exception 'istek bulunamadi: %', request_id;
  end if;
  if req.target_id <> auth.uid() then
    raise exception 'yetkisiz: bu istek size ait degil';
  end if;
  if req.status <> 'pending' then
    raise exception 'istek zaten % durumunda, tekrar islenemez', req.status;
  end if;

  update follow_requests set status = new_status where id = request_id;

  if new_status = 'accepted' then
    insert into follows (follower_id, following_id)
    values (req.requester_id, req.target_id)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function respond_to_follow_request(uuid, text) from public;
grant execute on function respond_to_follow_request(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- STEP 5: follows_no_self kisiti. ONCE mevcut ihlalleri raporla; sifir
-- degilse migration'i DURDUR (Recep onayi olmadan hicbir satir silinmez).
-- ---------------------------------------------------------------------
do $$
declare
  violation_count integer;
begin
  select count(*) into violation_count from follows where follower_id = following_id;
  if violation_count > 0 then
    raise exception
      'follows_no_self ihlali bulundu: % satir kendi kendini takip ediyor. '
      'Migration durduruldu - Recep onayi olmadan bu kayitlar silinmeyecek. '
      'Once "select * from follows where follower_id = following_id;" ile incele.',
      violation_count;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'follows_no_self' and conrelid = 'follows'::regclass
  ) then
    alter table follows add constraint follows_no_self check (follower_id <> following_id);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- STEP 6: Engellenenler birbirini takip edemez (follows_insert guncelleme).
-- Mevcut policy adi onceden pg_policies ile dogrulandi: "follows_insert".
-- ---------------------------------------------------------------------
drop policy if exists "follows_insert" on follows;
create policy "follows_insert" on follows for insert with check (
  follower_id = auth.uid()
  and not exists (select 1 from blocks b where b.blocker_id = following_id and b.blocked_id = follower_id)
  and not exists (select 1 from blocks b where b.blocker_id = follower_id and b.blocked_id = following_id)
);


-- ---------------------------------------------------------------------
-- STEP 7: pets.deleted_at kolonu (SADECE SCAFFOLDING).
--
-- Bilinçli olarak simdi yapilmayanlar: pets_select RLS policy'sini
-- (su an "herkese gorunur", using(true)) deleted_at IS NULL kontrolu
-- eklemek icin DEGISTIRMIYORUZ. Nedeni: pet silme ozelligi henuz yok
-- (roadmap'te YAGNI olarak isaretli), ve bu kararin gercek bir gerilimi
-- var - eger pets_select'e "deleted_at is null or owner_id = auth.uid()"
-- eklersek, gecmis post'larin post_pets(pets(name,emoji)) join'i,
-- silinmis bir pet icin baskasina NULL/gorunmez donmeye baslar (gecmis
-- gonderilerdeki pet adi/emoji'si diger kullanicilardan gizlenir).
-- Bu, "pet silindiginde gecmis paylasimlarda ne gosterilecek" sorusuna
-- bagli bir URUN karari ve pet silme ozelligiyle birlikte, o ozelligin
-- kendi migration'inda ele alinmali - simdi tahmin yapip yanlis
-- davranis kodlamamak icin sadece kolon ekleniyor, policy AYNI KALIYOR.
-- ---------------------------------------------------------------------
alter table pets add column if not exists deleted_at timestamptz;

commit;
