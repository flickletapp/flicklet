-- =====================================================================
-- 007_profiles_bio icin geri alma. SADECE veri kaybi riski YOKSA
-- (hicbir profilde bio doluysa) devam eder - aksi halde durur.
-- =====================================================================

begin;

do $$
declare
  bio_count integer;
begin
  select count(*) into bio_count from public.profiles where bio is not null;
  if bio_count > 0 then
    raise exception
      'ROLLBACK DURDURULDU: % profilde bio verisi var. Bu kolonu silmek '
      'kalici veri kaybi olusturur. Recep onayi olmadan devam etme.',
      bio_count;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_bio_length_check;
alter table public.profiles drop column if exists bio;

commit;
