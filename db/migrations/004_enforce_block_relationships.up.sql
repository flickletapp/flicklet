-- =====================================================================
-- Asama 2 duzeltme migration'i (2. REVIZYON - onceki taslak henuz
-- commit edilmemisti, bu dosya onun yerini aliyor, staging'de zaten
-- calisan onceki taslagin uzerine GUVENLE tekrar calistirilabilir).
--
-- ONCE STAGING'DE DOGRULANACAK (ref: fygaihkirknoyeumcjyp); PRODUCTION'DA
-- YALNIZCA RECEP'IN AYRICA VERECEGI ACIK ONAYDAN SONRA CALISTIRILABILIR.
--
-- BULGU 1 (002 testlerinde bulundu, bkz. [[flicklet_002_migration_block_
-- check_gap]]): pet_follows_insert / follow_requests_insert RLS policy'
-- lerindeki iki yonlu block kontrolu tek yonlu calisiyordu.
--
-- BULGU 2 (1. revizyonda eklendi): kapali profiller (insan VE pet) icin
-- "once takip istegi, sonra onay" akisi semada hic yoktu.
--
-- 2. REVIZYON (bu dosya) - onceki turda session GUC bayragi
-- (`flicklet.accepting_request`) ile yapilan "trusted internal call"
-- ayrimi TAMAMEN KALDIRILDI. Yerine follow_requests.status'a GECICI bir
-- ARA DURUM (`accepting`) eklendi - "trusted call" artik bir session
-- degiskeni degil, VERİNİN KENDİSİNDE (ayni transaction icinde gorulen
-- bir satir durumu) ifade ediliyor:
--
--   pending --(RPC kabul baslar)--> accepting --(takip kaydi olusur)--> accepted
--
-- Guard trigger'lari artik "bu tam olarak eslesen bir 'accepting'
-- durumundaki istege karsilik geliyor mu?" diye SORGULUYOR (blocks gibi
-- baska bir tabloya degil, follow_requests'in KENDISINE bakarak) - bu
-- satiri SADECE respond_to_follow_request() (table owner, RLS bypass)
-- yazabilir, cunku: (a) INSERT'te status sadece 'pending' olabilir
-- (guard_follow_requests_insert hala bunu zorunlu kiliyor), (b) UPDATE
-- icin follow_requests'te HICBIR RLS policy YOK (RLS acik + policy yok
-- = normal kullanicilar icin TUM UPDATE'ler otomatik reddedilir/0 satir
-- etkiler) - yani normal bir authenticated kullanici hicbir zaman bir
-- istegi 'accepting' durumuna GETIREMEZ, sadece table owner (RPC)
-- yapabilir.
--
-- Hata durumunda geri donus: respond_to_follow_request() icinde
-- 'accepting' update'inden SONRA herhangi bir noktada RAISE EXCEPTION
-- olursa, PL/pgSQL'de yakalanmayan bir exception CAGRIYI YAPAN
-- transaction'i (bu fonksiyonun kendisini cagiran tek statement'i)
-- otomatik geri alir - yani 'accepting' update'i de geri alinir, satir
-- 'pending' olarak KALIR (ekstra kod gerekmez, Postgres'in normal
-- transaction/exception semantigi).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 0 (degisiklik yok): blocks tablosunun SELECT RLS policy'si bu
-- migration'da da DEGISTIRILMIYOR.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- STEP 1: follow_requests.status CHECK constraint'ine 'accepting' ara
-- durumu eklendi. pet_id kolonu (1. revizyondan, degismedi).
-- ---------------------------------------------------------------------
alter table public.follow_requests add column if not exists pet_id uuid references public.pets(id) on delete cascade;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'follow_requests_status_check' and conrelid = 'public.follow_requests'::regclass) then
    alter table public.follow_requests drop constraint follow_requests_status_check;
  end if;
  alter table public.follow_requests add constraint follow_requests_status_check
    check (status in ('pending', 'accepted', 'rejected', 'accepting'));
end $$;


-- ---------------------------------------------------------------------
-- STEP 2: Pending tekillik - iki partial unique index (1. revizyondan,
-- degismedi). `accepting` durumundaki satirlar bu index'lere HIC GIRMEZ
-- (predicate'ler status='pending'), bu zararsizdir - 'accepting' cok
-- kisa omurlu ve tek bir aktif RPC cagrisina ait olur.
-- ---------------------------------------------------------------------
drop index if exists follow_requests_pending_unique;

create unique index if not exists follow_requests_pending_human_unique
  on public.follow_requests (requester_id, target_id)
  where status = 'pending' and pet_id is null;

create unique index if not exists follow_requests_pending_pet_unique
  on public.follow_requests (requester_id, pet_id)
  where status = 'pending' and pet_id is not null;


-- ---------------------------------------------------------------------
-- STEP 3: guard_follows_insert - dogrudan `follows` insert'lerini korur.
-- Kimlik kontrolu YOK (RLS'in isi). self-follow + iki yonlu block HER
-- ZAMAN kontrol edilir. Hedef KAPALIYSA insert REDDEDILIR - TEK ISTISNA:
-- tam olarak bu (requester_id=follower_id, target_id=following_id,
-- pet_id IS NULL) icin `accepting` durumunda bir follow_requests satiri
-- VARSA (yani bu insert, RPC'nin kabul akisindan geliyor).
-- ---------------------------------------------------------------------
create or replace function public.guard_follows_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.follower_id = new.following_id then
    raise exception 'gecersiz: kendi kendini takip edemez';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.following_id and b.blocked_id = new.follower_id)
       or (b.blocker_id = new.follower_id and b.blocked_id = new.following_id)
  ) then
    raise exception 'bu islem gerceklestirilemedi';
  end if;

  if not exists (
    select 1 from public.follow_requests fr
    where fr.status = 'accepting'
      and fr.pet_id is null
      and fr.requester_id = new.follower_id
      and fr.target_id = new.following_id
  ) then
    if exists (select 1 from public.profiles p where p.id = new.following_id and p.is_private = true) then
      raise exception 'gecersiz: bu profil kapali - once takip istegi gonderilmeli';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_follows_insert() from public, anon, authenticated, service_role;

drop trigger if exists follows_insert_guard on public.follows;
create trigger follows_insert_guard
  before insert on public.follows
  for each row execute function public.guard_follows_insert();


-- ---------------------------------------------------------------------
-- STEP 4: guard_pet_follows_insert - dogrudan `pet_follows` insert'
-- lerini korur. Ayni desen: 'accepting' durumunda eslesen bir pet
-- follow_requests satiri VARSA gizlilik kontrolu atlanir.
-- ---------------------------------------------------------------------
create or replace function public.guard_pet_follows_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet_owner uuid;
begin
  select owner_id into pet_owner from public.pets where id = new.pet_id;
  if not found then
    raise exception 'pet bulunamadi: %', new.pet_id;
  end if;

  if pet_owner = new.follower_id then
    raise exception 'gecersiz: kendi petini takip edemez';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = pet_owner and b.blocked_id = new.follower_id)
       or (b.blocker_id = new.follower_id and b.blocked_id = pet_owner)
  ) then
    raise exception 'bu islem gerceklestirilemedi';
  end if;

  if not exists (
    select 1 from public.follow_requests fr
    where fr.status = 'accepting'
      and fr.pet_id = new.pet_id
      and fr.requester_id = new.follower_id
  ) then
    if exists (select 1 from public.profiles p where p.id = pet_owner and p.is_private = true) then
      raise exception 'gecersiz: pet sahibinin profili kapali - once takip istegi gonderilmeli';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_pet_follows_insert() from public, anon, authenticated, service_role;

drop trigger if exists pet_follows_insert_guard on public.pet_follows;
create trigger pet_follows_insert_guard
  before insert on public.pet_follows
  for each row execute function public.guard_pet_follows_insert();


-- ---------------------------------------------------------------------
-- STEP 5: guard_follow_requests_insert - degismedi (1. revizyondan) -
-- YENI bir satir HALA sadece 'pending' olabilir (accepting/accepted/
-- rejected ile INSERT reddedilir). Bu, normal bir kullanicinin dogrudan
-- 'accepting' durumunda bir istek OLUSTURAMAMASINI garanti eder.
-- ---------------------------------------------------------------------
create or replace function public.guard_follow_requests_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet_owner uuid;
begin
  if new.status <> 'pending' then
    raise exception 'gecersiz: yeni takip istegi sadece pending durumunda olusturulabilir (verilen: %)', new.status;
  end if;

  if new.pet_id is null then
    if new.requester_id = new.target_id then
      raise exception 'gecersiz: kendine takip istegi gonderilemez';
    end if;

    if not exists (select 1 from public.profiles p where p.id = new.target_id and p.is_private = true) then
      raise exception 'gecersiz: bu profil acik - dogrudan takip et (follows) kullanilmali';
    end if;

    if exists (
      select 1 from public.blocks b
      where (b.blocker_id = new.target_id and b.blocked_id = new.requester_id)
         or (b.blocker_id = new.requester_id and b.blocked_id = new.target_id)
    ) then
      raise exception 'bu istek olusturulamadi';
    end if;

    if exists (
      select 1 from public.follows f
      where f.follower_id = new.requester_id and f.following_id = new.target_id
    ) then
      raise exception 'zaten takip ediliyor';
    end if;

  else
    select owner_id into pet_owner from public.pets where id = new.pet_id;
    if not found then
      raise exception 'pet bulunamadi: %', new.pet_id;
    end if;

    if pet_owner <> new.target_id then
      raise exception 'gecersiz: target_id, petin sahibiyle eslesmiyor';
    end if;

    if new.requester_id = pet_owner then
      raise exception 'gecersiz: kendi petine takip istegi gonderilemez';
    end if;

    if not exists (select 1 from public.profiles p where p.id = pet_owner and p.is_private = true) then
      raise exception 'gecersiz: pet sahibinin profili acik - dogrudan takip et (pet_follows) kullanilmali';
    end if;

    if exists (
      select 1 from public.blocks b
      where (b.blocker_id = pet_owner and b.blocked_id = new.requester_id)
         or (b.blocker_id = new.requester_id and b.blocked_id = pet_owner)
    ) then
      raise exception 'bu istek olusturulamadi';
    end if;

    if exists (
      select 1 from public.pet_follows pf
      where pf.follower_id = new.requester_id and pf.pet_id = new.pet_id
    ) then
      raise exception 'zaten takip ediliyor';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_follow_requests_insert() from public, anon, authenticated, service_role;

drop trigger if exists follow_requests_insert_guard on public.follow_requests;
create trigger follow_requests_insert_guard
  before insert on public.follow_requests
  for each row execute function public.guard_follow_requests_insert();


-- ---------------------------------------------------------------------
-- STEP 6: respond_to_follow_request() - GUC BAYRAGI KALDIRILDI, artik
-- durum makinesi: pending -> accepting -> (takip kaydi) -> accepted.
-- Reddedilirse dogrudan pending -> rejected (ara durum yok, gerek yok -
-- reddetmek hicbir kapali-hedef yazma islemi icermiyor).
-- ---------------------------------------------------------------------
create or replace function public.respond_to_follow_request(request_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.follow_requests%rowtype;
  current_owner uuid;
begin
  if new_status not in ('accepted', 'rejected') then
    raise exception 'gecersiz durum: % (sadece accepted/rejected kabul edilir)', new_status;
  end if;

  select * into req from public.follow_requests where id = request_id for update;
  if not found then
    raise exception 'istek bulunamadi: %', request_id;
  end if;
  if req.target_id <> auth.uid() then
    raise exception 'yetkisiz: bu istek size ait degil';
  end if;
  if req.status <> 'pending' then
    raise exception 'istek zaten % durumunda, tekrar islenemez', req.status;
  end if;

  if new_status = 'rejected' then
    update public.follow_requests set status = 'rejected' where id = request_id;
    return;
  end if;

  -- accepted yolu: pending -> accepting -> (insert) -> accepted.
  -- Asagida herhangi bir RAISE EXCEPTION olursa bu UPDATE de geri
  -- alinir, satir 'pending' olarak kalir (Postgres transaction/exception
  -- semantigi, ekstra kod gerekmez).
  update public.follow_requests set status = 'accepting' where id = request_id;

  if req.pet_id is null then
    if req.requester_id = req.target_id then
      raise exception 'gecersiz durum: kendi kendini takip edemez';
    end if;

    if exists (
      select 1 from public.blocks b
      where (b.blocker_id = req.target_id and b.blocked_id = req.requester_id)
         or (b.blocker_id = req.requester_id and b.blocked_id = req.target_id)
    ) then
      raise exception 'bu istek kabul edilemedi';
    end if;

    insert into public.follows (follower_id, following_id)
    values (req.requester_id, req.target_id)
    on conflict do nothing;
  else
    select owner_id into current_owner from public.pets where id = req.pet_id;
    if not found then
      raise exception 'pet artik mevcut degil, istek kabul edilemedi';
    end if;
    if current_owner <> req.target_id then
      raise exception 'pet sahibi degisti, istek kabul edilemedi';
    end if;

    if exists (
      select 1 from public.blocks b
      where (b.blocker_id = current_owner and b.blocked_id = req.requester_id)
         or (b.blocker_id = req.requester_id and b.blocked_id = current_owner)
    ) then
      raise exception 'bu istek kabul edilemedi';
    end if;

    insert into public.pet_follows (follower_id, pet_id)
    values (req.requester_id, req.pet_id)
    on conflict do nothing;
  end if;

  update public.follow_requests set status = 'accepted' where id = request_id;
end;
$$;

-- service_role dahil hicbir client rolu calistiramaz, SADECE authenticated.
revoke all on function public.respond_to_follow_request(uuid, text) from public, anon, service_role, authenticated, supabase_auth_admin;
grant execute on function public.respond_to_follow_request(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- STEP 7: RLS policy'leri (degismedi, 1. revizyondan) - SADECE kimlik
-- dogrulamasi. follow_requests icin HALA hicbir UPDATE policy YOK -
-- yani normal bir authenticated kullanici follow_requests'i asla
-- UPDATE edemez (0 satir etkiler), 'accepting' durumuna gecis SADECE
-- table owner (respond_to_follow_request RPC'si) icin mumkundur.
-- ---------------------------------------------------------------------
drop policy if exists "follows_insert" on public.follows;
create policy "follows_insert" on public.follows for insert with check (
  follower_id = auth.uid()
);

drop policy if exists "pet_follows_insert" on public.pet_follows;
create policy "pet_follows_insert" on public.pet_follows for insert with check (
  follower_id = auth.uid()
);

drop policy if exists "follow_requests_insert" on public.follow_requests;
create policy "follow_requests_insert" on public.follow_requests for insert with check (
  requester_id = auth.uid()
);

commit;
