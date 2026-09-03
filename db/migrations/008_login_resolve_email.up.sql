-- =====================================================================
-- Asama 2 ek migration: kullanici adiyla giris destegi icin GUVENLI
-- kimlik->e-posta cozumleme fonksiyonu.
--
-- ONCE STAGING'DE DOGRULANACAK (ref: fygaihkirknoyeumcjyp); PRODUCTION'DA
-- YALNIZCA RECEP'IN AYRICA VERECEGI ACIK ONAYDAN SONRA CALISTIRILABILIR.
--
-- GUVENLIK TASARIMI (onemli):
-- Supabase GoTrue (/auth/v1/token?grant_type=password) SADECE e-posta
-- (veya telefon) ile calisir, kullanici adi kabul etmez. Kullanici adiyla
-- giris icin istemcinin once kullanici adini e-postaya cozmesi gerekir.
--
-- BASIT bir "handle -> email" RPC'si (sifre kontrolu olmadan) ISTENMEDI,
-- cunku boyle bir fonksiyon anon anahtarla CAGIRILABILIR olur ve herhangi
-- biri butun kullanici adlarini denerek e-posta adreslerini toplu halde
-- (enumeration) toplayabilir - bu tam olarak talepte ACIKCA YASAKLANAN
-- sey ("...herkese acan guvensiz bir sorgu/RPC olusturma").
--
-- Bunun yerine bu fonksiyon SIFREYI DE parametre olarak alir ve
-- auth.users.encrypted_password'e karsi (ayni GoTrue'nun kullandigi
-- bcrypt algoritmasiyla, extensions.crypt() ile) DOGRULAR. E-posta
-- SADECE sifre dogruysa donuyor. Yani bu fonksiyon, dogru sifreyi
-- BILMEYEN biri icin hicbir zaman "bu kullanici adi var mi / e-postasi
-- ne" bilgisini sizdirmiyor - basarili bir giris zaten kullaniciya kendi
-- e-postasini gosterir (mevcut /auth/v1/user cagrisi da ayni bilgiyi
-- verir), bu yeni bir sizinti degil.
--
-- Yeni bir RLS/tablo degisikligi yok - sadece bu tek fonksiyon.
-- =====================================================================

begin;

create or replace function public.login_resolve_email(p_identifier text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_normalized text;
  v_encrypted text;
begin
  if p_identifier is null or p_password is null or p_password = '' then
    return null;
  end if;

  -- Basinda "@" varsa (kullanici adi isareti olarak) ve/veya bosluk
  -- varsa temizle, kucuk harfe cevir. profiles.handle degerleri de
  -- kendi icinde "@" ile basliyor (orn. "@ridvan") - o yuzden ayni
  -- normalizasyon karsilastirmada handle tarafina da uygulaniyor.
  v_normalized := lower(ltrim(trim(both from p_identifier), '@'));
  if v_normalized = '' then
    return null;
  end if;

  select p.id into v_id
  from public.profiles p
  where lower(ltrim(p.handle, '@')) = v_normalized
  limit 1;

  if v_id is null then
    return null;
  end if;

  select u.encrypted_password into v_encrypted
  from auth.users u
  where u.id = v_id;

  if v_encrypted is null or v_encrypted = '' then
    return null;
  end if;

  if v_encrypted = extensions.crypt(p_password, v_encrypted) then
    return (select email from auth.users where id = v_id);
  end if;

  return null;
end;
$$;

revoke all on function public.login_resolve_email(text, text) from public;
-- anon: giris yapmamis kullanici da cagirabilmeli (bu zaten girisin
-- kendisi). authenticated: zararsiz, tutarlilik icin verildi.
grant execute on function public.login_resolve_email(text, text) to anon, authenticated;

commit;
