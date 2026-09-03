-- =====================================================================
-- Asama 2 ek migration: profiles.bio (kisa biyografi) kolonu.
--
-- ONCE STAGING'DE DOGRULANACAK (ref: fygaihkirknoyeumcjyp); PRODUCTION'DA
-- YALNIZCA RECEP'IN AYRICA VERECEGI ACIK ONAYDAN SONRA CALISTIRILABILIR.
--
-- Mevcut RLS'e HICBIR SEKILDE dokunulmuyor - zaten yeterli:
--   - "Profiller herkese görünür" (profiles_select, using(true)) - bio
--     da diger alanlar gibi herkese acik okunur olacak (istenen davranis).
--   - "Kullanıcı kendi profilini günceller" (profiles_update, using
--     auth.uid()=id) - bir kullanici SADECE kendi bio'sunu degistirebilir,
--     baskasininkini degistiremez. Ek policy gerekmiyor.
-- Tek eklenen kisit: 160 karakter ust siniri (CHECK constraint - RLS
-- degil, veri butunlugu kurali).
-- =====================================================================

begin;

alter table public.profiles add column if not exists bio text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_bio_length_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 160);
  end if;
end $$;

commit;
