-- =====================================================================
-- BOSLUK: "Profili duzenle" yolu (public.profiles UPDATE/INSERT'i
-- dogrudan PostgREST uzerinden yapiyor) 014'teki auth.users trigger'inin
-- HICBIR sekilde gormedigi bir yoldu - client tarafinda format
-- dogrulamasi da HIC YAPILMIYORDU. Sonuc: gecersiz karakterli
-- ("byrecko34%*/2ş" gibi) bir handle DB'ye dogrudan yazilabildi.
--
-- YENI DAVRANIS: public.profiles uzerinde BEFORE INSERT OR UPDATE
-- trigger'i - handle YENI olusturuluyorsa (INSERT) veya GERCEKTEN
-- degistiriliyorsa (UPDATE ve NEW.handle IS DISTINCT FROM OLD.handle)
-- '^@[A-Za-z0-9_]{3,20}$' desenine uymuyorsa kayit ACIKCA reddedilir -
-- sessizce temizleme/donusturme YOK (014'teki ayni ilke).
--
-- BILINCLI TASARIM: duz bir CHECK constraint (hatta NOT VALID) yerine
-- trigger secildi - cunku CHECK constraint, satirin BASKA bir alani
-- (orn. bio) degistirilmeye calisildiginda da TUM satiri yeniden
-- degerlendirir; bu da mevcut gecersiz "@byrecko34%*/2ş" satirini
-- (id 397ca01d-fa6f-4cb6-b00b-d2fea6408504) handle disinda hicbir
-- alanda guncellenemez hale getirirdi. Trigger'daki "IS DISTINCT FROM"
-- kontrolu sayesinde bu satir handle DISINDAKI alanlarda serbestce
-- guncellenebiliyor; SADECE kullanici handle'i fiilen degistirmeye
-- calistiginda yeni kural devreye giriyor.
--
-- Mevcut gecersiz satir OTOMATIK degistirilmiyor/silinmiyor -
-- kullanici arayuzden ne zaman isterse gecerli bir ad secebilir.
--
-- profiles_handle_lower_unique (013) ve migration 014'teki
-- auth.users trigger'i DEGISMEDEN kaliyor - bu migration onlara
-- EK bir koruma katmani ekliyor, yerlerini almiyor.
--
-- ONCE STAGING'DE (ref: fygaihkirknoyeumcjyp). PRODUCTION'A UYGULANMADI.
-- =====================================================================

begin;

-- SECURITY INVOKER (varsayilan) yeterli: bu trigger'i tetikleyen rol
-- (authenticated) zaten kendi profiles satirini UPDATE etme hakkina
-- sahip (RLS) - 014'teki auth.users trigger'inin aksine burada
-- sema-lar arasi ayricalik yukseltmeye gerek yok.
create or replace function public.enforce_profiles_handle_format()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.handle is distinct from old.handle) then
    if new.handle !~ '^@[A-Za-z0-9_]{3,20}$' then
      raise exception using
        errcode = 'FL001',
        message = 'invalid_username',
        detail = 'Kullanıcı adı yalnızca harf, rakam ve alt çizgi (_) içerebilir, 3-20 karakter olmalı.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_handle_format_guard on public.profiles;
create trigger profiles_handle_format_guard
before insert or update on public.profiles
for each row execute function public.enforce_profiles_handle_format();

commit;
