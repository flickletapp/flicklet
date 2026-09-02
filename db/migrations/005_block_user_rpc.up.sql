-- =====================================================================
-- Asama 2 duzeltme migration'i: atomik engelleme RPC'si + iki yonlu
-- engel kontrolu icin istemcinin cagirabildigi guvenli yardimci
-- fonksiyonlar.
--
-- ONCE STAGING'DE DOGRULANACAK (ref: fygaihkirknoyeumcjyp); PRODUCTION'DA
-- YALNIZCA RECEP'IN AYRICA VERECEGI ACIK ONAYDAN SONRA CALISTIRILABILIR.
--
-- BULGU (UserProfileView'daki ilk engelleme uygulamasinda bulundu):
-- follows_delete/pet_follows_delete/follow_requests_delete RLS
-- policy'leri SADECE "auth.uid() = follower_id/requester_id" olan
-- satirlari silmeye izin veriyor. Yani bir kullanici (A) baskasini (B)
-- engelledigin de, A sadece KENDI olusturdugu follows/pet_follows/istek
-- satirlarini silebiliyordu - B'nin A'yi takip ettigi eski satir RLS
-- yuzunden SILINEMIYORDU. Ayrica arama/profil goruntuleme, sadece
-- `blocker_id = auth.uid()` gorebilen RLS'e dayandigi icin B, A'yi
-- engellemis olsa bile A'nin blocked_id=A oldugu satiri GOREMEDIGI icin
-- (RLS "Kullanıcı kendi engel listesini görür" sadece blocker_id=
-- auth.uid() gosteriyor) bu yonde bir gizleme YAPILAMIYORDU.
--
-- COZUM:
--   - `block_user(blocked_user_id)`: SECURITY DEFINER, RLS'i atomik ve
--     GUVENLI sekilde bypass ederek blocks satirini ekliyor VE iki
--     yonlu follows/pet_follows/follow_requests temizligini TEK
--     transaction'da (fonksiyon cagrisi atomik) yapiyor.
--   - `blocked_with(other_user_id)` / `blocked_among(candidate_ids)`:
--     istemcinin salt-okunur RLS'in gosteremedigi yonu de kapsayan,
--     iki yonlu engel durumunu SADECE boolean/id listesi olarak (hangi
--     tarafin blockladigini ifsa etmeden) doner - arama ve profil
--     goruntuleme bunlara dayanmali, dogrudan `blocks` tablosuna degil.
--
-- unblock icin YENI bir RPC EKLENMIYOR (kasitli) - mevcut DELETE +
-- "Kullanıcı engeli kaldırır" RLS policy'si (using: auth.uid() =
-- blocker_id) zaten SADECE kendi olusturdugun engeli kaldirmana izin
-- veriyor, ayrica bir atomik/coklu-tablo islemi gerekmiyor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- STEP 1: iki yonlu engel kontrolu icin istemciye acik, SECURITY
-- DEFINER yardimci fonksiyonlar. Ikisi de SADECE boolean/id donuyor,
-- kim-kimi-blockladigini ifsa etmiyor (004'teki "hata mesaji block
-- yonunu ifsa etmesin" ilkesiyle ayni).
-- ---------------------------------------------------------------------
create or replace function public.blocked_with(other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other_user_id)
       or (b.blocker_id = other_user_id and b.blocked_id = auth.uid())
  );
$$;

revoke all on function public.blocked_with(uuid) from public, anon, service_role, supabase_auth_admin;
grant execute on function public.blocked_with(uuid) to authenticated;


create or replace function public.blocked_among(candidate_ids uuid[])
returns table(blocked_id uuid)
language sql
security definer
stable
set search_path = ''
as $$
  select b.blocked_id from public.blocks b
    where b.blocker_id = auth.uid() and b.blocked_id = any(candidate_ids)
  union
  select b.blocker_id as blocked_id from public.blocks b
    where b.blocked_id = auth.uid() and b.blocker_id = any(candidate_ids);
$$;

revoke all on function public.blocked_among(uuid[]) from public, anon, service_role, supabase_auth_admin;
grant execute on function public.blocked_among(uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- STEP 2: block_user(blocked_user_id) - atomik engelleme.
-- Parametre BILEREK `blocked_user_id` adlandirildi - `target_id` gibi
-- follow_requests kolon adiyla ayni isim kullanilsaydi, fonksiyon
-- govdesindeki sorgularda PL/pgSQL parametre golgeleme (shadowing)
-- riski olurdu.
-- ---------------------------------------------------------------------
create or replace function public.block_user(blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'yetkisiz';
  end if;
  if actor = blocked_user_id then
    raise exception 'gecersiz: kendini engelleyemezsin';
  end if;
  if not exists (select 1 from public.profiles where id = blocked_user_id) then
    raise exception 'kullanici bulunamadi';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (actor, blocked_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Iki yonlu dogrudan takip temizligi.
  delete from public.follows
  where (follower_id = actor and following_id = blocked_user_id)
     or (follower_id = blocked_user_id and following_id = actor);

  -- Iki yonlu pet takibi temizligi: actor'un blocked_user_id'nin
  -- petlerini takip ettigi VE blocked_user_id'nin actor'un petlerini
  -- takip ettigi satirlar.
  delete from public.pet_follows pf
  using public.pets p
  where pf.pet_id = p.id
    and (
      (pf.follower_id = actor and p.owner_id = blocked_user_id)
      or (pf.follower_id = blocked_user_id and p.owner_id = actor)
    );

  -- Iki yonlu bekleyen istek temizligi (insan VE pet - pet istegi icin
  -- target_id zaten petin owner_id'sine esit oldugundan, asagidaki iki
  -- kosul her iki turu de kapsiyor, ayri pet_id kontrolu gerekmiyor).
  delete from public.follow_requests
  where status = 'pending'
    and (
      (requester_id = actor and target_id = blocked_user_id)
      or (requester_id = blocked_user_id and target_id = actor)
    );
end;
$$;

revoke all on function public.block_user(uuid) from public, anon, service_role, supabase_auth_admin;
grant execute on function public.block_user(uuid) to authenticated;

commit;
