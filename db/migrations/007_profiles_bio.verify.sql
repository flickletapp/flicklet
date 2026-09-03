-- =====================================================================
-- 007 migration'i staging'de calistirdiktan SONRA elle calistirilacak
-- dogrulama sorgulari. Hepsi salt-okunur.
-- =====================================================================

-- 1) Kolon var mi, nullable text mi?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'bio';
-- BEKLENEN: 1 satir, data_type=text, is_nullable=YES.

-- 2) 160 karakter CHECK constraint'i var mi?
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.profiles'::regclass and conname = 'profiles_bio_length_check';
-- BEKLENEN: 1 satir, "CHECK ((bio IS NULL) OR (char_length(bio) <= 160))".

-- 3) profiles RLS policy'leri DEGISMEDI mi (select/update ayni)?
select policyname, cmd, qual from pg_policies where tablename = 'profiles' order by cmd, policyname;
-- BEKLENEN: 001'den beri aynı 3 policy (insert/select/update), bio'ya
-- ozel yeni bir policy YOK.
