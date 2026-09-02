-- 001_baseline_schema.sql
-- Production 'public' semasinin SALT-OKUNUR dokumu (2026-09-02, dogrulanmis).
-- SADECE yapi: tablo/kolon/constraint/index/fonksiyon/trigger/policy.
-- HICBIR satir veri, kullanici verisi, secret veya auth/storage/realtime/
-- vault/extensions semasinin TAM ICERIGI yok. Tek istisna: en altta,
-- auth.users uzerindeki TEK bir trigger'in tanimi acikca yorumlanarak
-- eklendi (auth semasi baska hicbir sekilde dump edilmedi).
--
-- Sira: tablolar -> primary/unique -> foreign key -> indeksler ->
-- fonksiyon -> trigger -> RLS -> policy (istenen siraya gore).
--
-- Bu dosya staging Supabase projesine (flicklet-staging) temel semayi
-- kurmak icin uretildi, HENUZ hicbir yerde calistirilmadi.

begin;

-- ---------------------------------------------------------------------
-- TABLOLAR (13) - kolon bazinda dogrulandi: tum kolonlarda
-- is_identity=NO, is_generated=NEVER (identity/generated kolon yok).
-- ---------------------------------------------------------------------

create table if not exists blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists category_suggestion_votes (
  suggestion_id uuid not null,
  voter_id uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists category_suggestions (
  id uuid default gen_random_uuid() not null,
  name text not null,
  created_by uuid,
  created_at timestamptz default now() not null
);

create table if not exists comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  author_id uuid not null,
  text text not null,
  created_at timestamptz default now() not null
);

create table if not exists contest_votes (
  id uuid default gen_random_uuid() not null,
  post_id uuid,
  voter_id uuid,
  voted_on date default CURRENT_DATE,
  created_at timestamptz default now()
);

create table if not exists follows (
  follower_id uuid not null,
  following_id uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists likes (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists messages (
  id uuid default gen_random_uuid() not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  text text not null,
  created_at timestamptz default now() not null,
  read boolean default false not null
);

create table if not exists pets (
  id uuid default gen_random_uuid() not null,
  owner_id uuid,
  name text not null,
  species text not null,
  emoji text default '🐾'::text,
  created_at timestamptz default now()
);

create table if not exists posts (
  id uuid default gen_random_uuid() not null,
  author_id uuid not null,
  pet_id uuid,
  caption text not null,
  image_url text,
  contest_category text,
  created_at timestamptz default now() not null
);

create table if not exists profiles (
  id uuid not null,
  handle text not null,
  display_name text not null,
  is_private boolean default false,
  created_at timestamptz default now(),
  avatar_url text,
  dm_policy text default 'everyone'::text not null
);

create table if not exists reports (
  id uuid default gen_random_uuid() not null,
  post_id uuid,
  reporter_id uuid,
  reason text not null,
  status text default 'pending'::text,
  created_at timestamptz default now()
);

create table if not exists vote_streaks (
  user_id uuid not null,
  current_month_votes integer default 0,
  last_vote_date date,
  badge_earned boolean default false
);


-- ---------------------------------------------------------------------
-- PRIMARY / UNIQUE KEYS
-- ---------------------------------------------------------------------
alter table blocks add constraint blocks_pkey primary key (blocker_id, blocked_id);
alter table category_suggestion_votes add constraint category_suggestion_votes_pkey primary key (suggestion_id, voter_id);
alter table category_suggestions add constraint category_suggestions_pkey primary key (id);
alter table comments add constraint comments_pkey primary key (id);
alter table contest_votes add constraint contest_votes_pkey primary key (id);
alter table follows add constraint follows_pkey primary key (follower_id, following_id);
alter table likes add constraint likes_pkey primary key (post_id, user_id);
alter table messages add constraint messages_pkey primary key (id);
alter table pets add constraint pets_pkey primary key (id);
alter table posts add constraint posts_pkey primary key (id);
alter table profiles add constraint profiles_pkey primary key (id);
alter table reports add constraint reports_pkey primary key (id);
alter table vote_streaks add constraint vote_streaks_pkey primary key (user_id);

alter table profiles add constraint profiles_handle_key unique (handle);
alter table contest_votes add constraint contest_votes_voter_id_voted_on_key unique (voter_id, voted_on);

alter table pets add constraint pets_species_check check ((species = ANY (ARRAY['cat'::text, 'dog'::text, 'other'::text])));
alter table reports add constraint reports_status_check check ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])));


-- ---------------------------------------------------------------------
-- FOREIGN KEYS (20 - ilk taslakta profiles_id_fkey sema-filtresi
-- yuzunden atlanmisti, duzeltildi). Hicbiri DEFERRABLE degil
-- (condeferrable=false / condeferred=false, hepsi dogrulandi).
--
-- NOT: profiles_id_fkey, public disindaki auth.users tablosuna
-- referans veriyor. auth.users tablosunun KENDISI bu dosyada
-- OLUSTURULMUYOR (Supabase her projede bunu otomatik saglar,
-- flicklet-staging'de de zaten var) - sadece bu FK constraint'i,
-- production'daki public.profiles tanimini birebir yansitmak icin
-- ekleniyor.
-- ---------------------------------------------------------------------
alter table posts add constraint posts_author_id_fkey foreign key (author_id) references profiles(id) on delete cascade;
alter table posts add constraint posts_pet_id_fkey foreign key (pet_id) references pets(id) on delete cascade;
alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table likes add constraint likes_post_id_fkey foreign key (post_id) references posts(id) on delete cascade;
alter table likes add constraint likes_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table comments add constraint comments_post_id_fkey foreign key (post_id) references posts(id) on delete cascade;
alter table pets add constraint pets_owner_id_fkey foreign key (owner_id) references profiles(id) on delete cascade;
alter table contest_votes add constraint contest_votes_voter_id_fkey foreign key (voter_id) references profiles(id) on delete cascade;
alter table vote_streaks add constraint vote_streaks_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references profiles(id) on delete cascade;
alter table blocks add constraint blocks_blocker_id_fkey foreign key (blocker_id) references profiles(id) on delete cascade;
alter table blocks add constraint blocks_blocked_id_fkey foreign key (blocked_id) references profiles(id) on delete cascade;
alter table comments add constraint comments_author_id_fkey foreign key (author_id) references profiles(id) on delete cascade;
alter table follows add constraint follows_follower_id_fkey foreign key (follower_id) references profiles(id) on delete cascade;
alter table follows add constraint follows_following_id_fkey foreign key (following_id) references profiles(id) on delete cascade;
alter table category_suggestions add constraint category_suggestions_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;
alter table category_suggestion_votes add constraint category_suggestion_votes_suggestion_id_fkey foreign key (suggestion_id) references category_suggestions(id) on delete cascade;
alter table category_suggestion_votes add constraint category_suggestion_votes_voter_id_fkey foreign key (voter_id) references profiles(id) on delete cascade;
alter table messages add constraint messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
alter table messages add constraint messages_recipient_id_fkey foreign key (recipient_id) references profiles(id) on delete cascade;


-- ---------------------------------------------------------------------
-- INDEKSLER: pg_indexes ile production'da TOPLAM 15 index dogrulandi -
-- hepsi yukaridaki primary key (13) ve unique constraint'lerin (2)
-- otomatik olarak actigi indeksler. Constraint disinda, EK/bagimsiz
-- bir index YOK (audit'teki "ek index 0" bulgusu boylece dogrulandi).
-- Bu yuzden burada ayrica CREATE INDEX satiri yok - yukaridaki
-- constraint'ler zaten hepsini kapsiyor.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- FONKSIYON: handle_new_user - production'daki HALIYLE birebir
-- yansitiliyor (owner: postgres, SECURITY DEFINER: true).
--
-- ONEMLI GUVENLIK NOTU (production'da zaten boyle, bu dosyanin
-- yarattigi bir sey degil, sadece dogru sekilde yansitiliyor):
--   - search_path SABIT DEGIL (proconfig = null). 002 migration'daki
--     kendi RPC'mizde (respond_to_follow_request) bunu bilerek
--     `set search_path = public` ile sabitledik; ama bu ESKI
--     fonksiyon production'da hala sabitlenmemis halde.
--   - EXECUTE yetkisi asiri genis: PUBLIC, anon, authenticated,
--     service_role, postgres - hepsi calistirabiliyor.
-- Bu bir Aşama 2 kapsam disi bulgu; baseline'in gorevi production'i
-- BIREBIR yansitmak oldugu icin duzeltilmeden aynen tasindi. Ayri bir
-- guvenlik hardening karari/onayi gerektirir.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    '@' || lower(split_part(new.email, '@', 1)) || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

-- Production'daki grant durumunu birebir yansit (asiri genis oldugu
-- yukarida not edildi, degistirilmeden tasindi).
grant execute on function public.handle_new_user() to public, anon, authenticated, service_role, postgres;


-- ---------------------------------------------------------------------
-- TRIGGER: auth.users uzerinde TEK bir trigger dogrulandi ve
-- production ile birebir eslesecek sekilde ekleniyor. auth semasinin
-- geri kalani (auth.users tablosunun kendisi dahil) bu dosyada
-- OLUSTURULMUYOR - Supabase her yeni projede bunu otomatik sagliyor,
-- flicklet-staging'de de zaten mevcut.
--
-- Dogrulanan tanim (production, pg_get_triggerdef ile):
--   name: on_auth_user_created
--   event: AFTER INSERT
--   tablo: auth.users
--   kapsam: FOR EACH ROW
--   kosul: yok (WHEN kosulu yok)
--   cagirdigi fonksiyon: handle_new_user()
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---------------------------------------------------------------------
-- RLS ENABLE (13/13 tablo)
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table pets enable row level security;
alter table contest_votes enable row level security;
alter table vote_streaks enable row level security;
alter table reports enable row level security;
alter table blocks enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;
alter table category_suggestions enable row level security;
alter table category_suggestion_votes enable row level security;
alter table messages enable row level security;


-- ---------------------------------------------------------------------
-- POLICIES (34) - hepsi rol olarak {public} (PostgreSQL "public" rolu,
-- yani policy tum rollere uygulaniyor, gercek erisim RLS ifadesinin
-- kendisiyle (auth.uid() vb.) kisitlaniyor). cmd/USING/WITH CHECK
-- production ile birebir.
-- ---------------------------------------------------------------------
create policy "Kullanıcı engeli kaldırır" on blocks for delete using ((auth.uid() = blocker_id));
create policy "Kullanıcı engelleme ekler" on blocks for insert with check ((auth.uid() = blocker_id));
create policy "Kullanıcı kendi engel listesini görür" on blocks for select using ((auth.uid() = blocker_id));

create policy "category_suggestion_votes_insert" on category_suggestion_votes for insert with check ((voter_id = auth.uid()));
create policy "category_suggestion_votes_select" on category_suggestion_votes for select using (true);

create policy "category_suggestions_insert" on category_suggestions for insert with check ((created_by = auth.uid()));
create policy "category_suggestions_select" on category_suggestions for select using (true);

create policy "comments_insert" on comments for insert with check ((author_id = auth.uid()));
create policy "comments_select" on comments for select using ((EXISTS ( SELECT 1
   FROM posts po
  WHERE (po.id = comments.post_id))));

create policy "Kullanıcı kendi oy geçmişini görür" on contest_votes for select using ((auth.uid() = voter_id));
create policy "Kullanıcı oy kullanır" on contest_votes for insert with check ((auth.uid() = voter_id));
create policy "contest_votes_public_select" on contest_votes for select using (true);

create policy "follows_delete" on follows for delete using ((follower_id = auth.uid()));
create policy "follows_insert" on follows for insert with check ((follower_id = auth.uid()));
create policy "follows_select" on follows for select using (true);

create policy "likes_delete" on likes for delete using ((user_id = auth.uid()));
create policy "likes_insert" on likes for insert with check ((user_id = auth.uid()));
create policy "likes_select" on likes for select using (true);

create policy "messages_insert" on messages for insert with check (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = messages.recipient_id) AND ((p.dm_policy = 'everyone'::text) OR (EXISTS ( SELECT 1
           FROM follows f
          WHERE ((f.follower_id = messages.sender_id) AND (f.following_id = messages.recipient_id))))))))));
create policy "messages_select" on messages for select using (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));
create policy "messages_update" on messages for update using ((recipient_id = auth.uid())) with check ((recipient_id = auth.uid()));

create policy "Hayvanlar herkese görünür" on pets for select using (true);
create policy "Sahibi hayvan ekler" on pets for insert with check ((auth.uid() = owner_id));
create policy "Sahibi hayvanını düzenler" on pets for update using ((auth.uid() = owner_id));

create policy "posts_delete" on posts for delete using ((author_id = auth.uid()));
create policy "posts_insert" on posts for insert with check ((author_id = auth.uid()));
create policy "posts_select" on posts for select using (((contest_category IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = posts.author_id) AND ((p.is_private = false) OR (p.id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM follows f
          WHERE ((f.follower_id = auth.uid()) AND (f.following_id = p.id))))))))));

create policy "Kayıt olan kendi profilini oluşturur" on profiles for insert with check ((auth.uid() = id));
create policy "Kullanıcı kendi profilini günceller" on profiles for update using ((auth.uid() = id));
create policy "Profiller herkese görünür" on profiles for select using (true);

create policy "Kullanıcı kendi şikayetini görür" on reports for select using ((auth.uid() = reporter_id));
create policy "Kullanıcı şikayet oluşturur" on reports for insert with check ((auth.uid() = reporter_id));

create policy "Kullanıcı kendi streak'ini görür" on vote_streaks for select using ((auth.uid() = user_id));
create policy "Kullanıcı kendi streak'ini günceller" on vote_streaks for all using ((auth.uid() = user_id));

commit;
