-- =====================================================================
-- 005_block_user_rpc icin geri alma. SADECE 005'in ekledigi 3
-- fonksiyonu kaldirir - blocks/follows/pet_follows/follow_requests
-- tablolarina veya verisine dokunmaz. Destructive DEGIL (veri kaybi
-- yok), ama geri alindiktan sonra engelleme islemi TEKRAR eski
-- (eksik) manuel temizlik yontemine donmek zorunda kalir - bu yuzden
-- yine de bilincli bir karar gerektirir.
-- =====================================================================

begin;

drop function if exists public.block_user(uuid);
drop function if exists public.blocked_among(uuid[]);
drop function if exists public.blocked_with(uuid);

commit;
