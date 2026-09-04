-- 015 icin geri alma. profiles.handle uzerindeki DB seviyesi format
-- guard trigger'ini kaldirir. Mevcut satirlar (gecerli veya gecersiz)
-- HICBIR SEKILDE degistirilmez - sadece koruma kaldirilir.

begin;

drop trigger if exists profiles_handle_format_guard on public.profiles;
drop function if exists public.enforce_profiles_handle_format();

commit;
