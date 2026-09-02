-- Asama 2: post_pets baglanti tablosu + pet_follows + follow_requests + kurallar
-- UYGULAMADAN ONCE: staging Supabase projesinde test et, sonra production'da
-- Recep onayi ve yedek alindiktan sonra calistir. Bu dosya henuz calistirilmadi.

-- 1) post_pets baglanti tablosu (posts.pet_id'nin yerini alacak, cok pet destegi icin)
create table post_pets (
  post_id uuid not null references posts(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, pet_id)
);
alter table post_pets enable row level security;
create policy "post_pets_select" on post_pets for select using (true);
create policy "post_pets_insert" on post_pets for insert with check (
  exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid())
);
create policy "post_pets_delete" on post_pets for delete using (
  exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid())
);

-- Mevcut posts.pet_id verisini post_pets'e tasi (veri kaybi olmaz, pet_id kolonu bu adimda silinmiyor)
insert into post_pets (post_id, pet_id)
  select id, pet_id from posts where pet_id is not null;

-- 2) pet_follows (bagimsiz pet takibi - sema hazir, kullanim UI'i Asama 7'de)
create table pet_follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, pet_id)
);
alter table pet_follows enable row level security;
create policy "pet_follows_select" on pet_follows for select using (true);
create policy "pet_follows_insert" on pet_follows for insert with check (
  follower_id = auth.uid()
  and not exists (
    select 1 from pets pt join blocks b on (b.blocker_id = pt.owner_id and b.blocked_id = auth.uid())
    where pt.id = pet_id
  )
);
create policy "pet_follows_delete" on pet_follows for delete using (follower_id = auth.uid());

-- 3) follow_requests (kapali profile takip onayi - sema hazir, kullanim UI'i Asama 7'de)
create table follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique (requester_id, target_id)
);
alter table follow_requests enable row level security;
create policy "follow_requests_select" on follow_requests for select using (
  requester_id = auth.uid() or target_id = auth.uid()
);
create policy "follow_requests_insert" on follow_requests for insert with check (requester_id = auth.uid());
create policy "follow_requests_update" on follow_requests for update using (target_id = auth.uid());

-- 4) Zorunlu kurallar
alter table follows add constraint follows_no_self check (follower_id <> following_id);
alter table pets add column if not exists deleted_at timestamptz;

-- 5) Engellenenler birbirini takip edemez (follows_insert guncelleme)
drop policy "follows_insert" on follows;
create policy "follows_insert" on follows for insert with check (
  follower_id = auth.uid()
  and not exists (select 1 from blocks b where b.blocker_id = following_id and b.blocked_id = follower_id)
  and not exists (select 1 from blocks b where b.blocker_id = follower_id and b.blocked_id = following_id)
);
