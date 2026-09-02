-- =====================================================================
-- DESTRUCTIVE SECURITY ROLLBACK / MANUAL-ONLY
--
-- 004_enforce_block_relationships (revize edilmis hali) icin geri alma.
-- SADECE 004'un EKLEDIGI/DEGISTIRDIGI seyleri kaldirir: guard trigger'
-- lari, guard fonksiyonlari, follow_requests.pet_id kolonu ve ona bagli
-- iki partial index, ve RLS policy'lerin 002'deki orijinal (kismen
-- kirik) mantigi. 002'nin TABLOLARINA veya VERISINE dokunmaz.
--
-- *** VERI KAYBI KORUMASI (pet_id) ***
-- follow_requests.pet_id kolonu additive olarak eklendi. Eger bu
-- kolonda pet_id IS NOT NULL olan (yani en az bir PET takip istegi
-- olusturulmus) satir varsa, bu kolonu silmek o istekleri KALICI OLARAK
-- pet baglantisindan koparir (veri kaybi). Bu yuzden asagida ONCE bir
-- kontrol var - veri varsa migration RAISE EXCEPTION ile DURUR, hicbir
-- degisiklik yapilmaz (transaction rollback). Devam etmek icin once bu
-- satirlarin ne yapilacagina (silinsin mi, ayri bir tabloya tasinsin mi)
-- Recep'in ELLE karar vermesi ve onaylamasi gerekir.
--
-- *** GUVENLIK RISKI UYARISI (fonksiyonel rollback) ***
-- Bu rollback basariyla tamamlanirsa sistem, iki yonlu block kontrolu
-- VE kapali profil/pet icin "once istek" kurali icin YENIDEN SADECE
-- 002'nin RLS policy'lerine dayanir. O policy'ler BILINEN BIR ACIK
-- tasir (bkz. [[flicklet_002_migration_block_check_gap]]): "karsi taraf
-- beni blockladi" yonu sessizce atlanir VE kapali profillere dogrudan
-- takip/pet takibi TEKRAR MUMKUN HALE GELIR (istek akisi kalkar). Bu
-- KABUL EDILEBILIR bir durum DEGILDIR. Sadece bilincli, tek seferlik
-- bir rollback karari sonrasi VE bu riski kabul ederek elle
-- calistirilmalidir. OTOMATIK CI/CD'DE CALISTIRILMAZ.
--
-- *** GRANT SIKILAsTIRMASI GERI ALINMIYOR (bilincli) ***
-- respond_to_follow_request()'in service_role/supabase_auth_admin
-- icin EXECUTE'unu kapatan revoke, bu rollback'te GERI ACILMIYOR -
-- bu saf bir yetki daraltmasidir, geri almak ayri, gereksiz bir risk
-- eklerdi. Sadece search_path 002'nin orijinal degeri olan 'public'e
-- donduruluyor (simetri icin).
-- =====================================================================

begin;

do $$
declare
  pet_request_count integer;
  accepting_count integer;
begin
  select count(*) into pet_request_count from public.follow_requests where pet_id is not null;
  if pet_request_count > 0 then
    raise exception
      'ROLLBACK DURDURULDU: follow_requests''ta % adet pet_id dolu satir var. '
      'Bu kolonu silmek o pet takip isteklerini kalici olarak kaybeder. '
      'Elle inceleme ve Recep onayi olmadan devam etme.',
      pet_request_count;
  end if;

  select count(*) into accepting_count from public.follow_requests where status = 'accepting';
  if accepting_count > 0 then
    raise exception
      'ROLLBACK DURDURULDU: % istek su anda "accepting" ara durumunda - '
      'muhtemelen aktif bir kabul islemi devam ediyor. Once bunun '
      'tamamlanmasini/hata vermesini bekle, sonra rollback''i tekrar dene.',
      accepting_count;
  end if;
end $$;

drop trigger if exists follow_requests_insert_guard on public.follow_requests;
drop function if exists public.guard_follow_requests_insert();

drop trigger if exists pet_follows_insert_guard on public.pet_follows;
drop function if exists public.guard_pet_follows_insert();

drop trigger if exists follows_insert_guard on public.follows;
drop function if exists public.guard_follows_insert();

-- respond_to_follow_request'in search_path'ini 004-oncesi (002) haline
-- dondur. Grant'lar (authenticated=true, digerleri false) BILEREK
-- GERI ACILMIYOR - yukaridaki notu bkz.
alter function public.respond_to_follow_request(uuid, text) set search_path = public;

-- Pending tekillik: yeni iki partial index'i kaldir, 002'nin orijinal
-- tek index'ini geri kur. Bu noktada pet_id dolu satir olmadigi yukarida
-- garanti edildi, yani asagidaki drop column veri kaybi olusturmaz.
drop index if exists follow_requests_pending_human_unique;
drop index if exists follow_requests_pending_pet_unique;

alter table public.follow_requests drop column if exists pet_id;

create unique index if not exists follow_requests_pending_unique
  on public.follow_requests (requester_id, target_id)
  where status = 'pending';

-- status CHECK constraint'ini 004-oncesi (3 deger) haline dondur -
-- 'accepting' ara durumu artik gecerli bir deger degil.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'follow_requests_status_check' and conrelid = 'public.follow_requests'::regclass) then
    alter table public.follow_requests drop constraint follow_requests_status_check;
  end if;
  alter table public.follow_requests add constraint follow_requests_status_check
    check (status in ('pending', 'accepted', 'rejected'));
end $$;

-- RLS policy'lerini 002'nin ORIJINAL (kismen kirik iki yonlu block
-- mantigini iceren) haline geri dondur - bu revizyon onlari sadelestirmisti.
drop policy if exists "follows_insert" on public.follows;
create policy "follows_insert" on public.follows for insert with check (
  follower_id = auth.uid()
  and not exists (select 1 from blocks b where b.blocker_id = following_id and b.blocked_id = follower_id)
  and not exists (select 1 from blocks b where b.blocker_id = follower_id and b.blocked_id = following_id)
);

drop policy if exists "pet_follows_insert" on public.pet_follows;
create policy "pet_follows_insert" on public.pet_follows for insert with check (
  follower_id = auth.uid()
  and not exists (
    select 1 from pets pt where pt.id = pet_id and pt.owner_id = auth.uid()
  )
  and not exists (
    select 1 from pets pt
    where pt.id = pet_id
      and (
        exists (select 1 from blocks b where b.blocker_id = pt.owner_id and b.blocked_id = auth.uid())
        or exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = pt.owner_id)
      )
  )
);

drop policy if exists "follow_requests_insert" on public.follow_requests;
create policy "follow_requests_insert" on public.follow_requests for insert with check (
  requester_id = auth.uid()
  and requester_id <> target_id
  and not exists (select 1 from blocks b where b.blocker_id = target_id and b.blocked_id = requester_id)
  and not exists (select 1 from blocks b where b.blocker_id = requester_id and b.blocked_id = target_id)
  and not exists (select 1 from follows f where f.follower_id = requester_id and f.following_id = target_id)
);

commit;
