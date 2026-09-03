import { supabaseSelect } from "../../lib/supabase/client";

// Takipçi/Takip listesi ortak sorgu+eşleme mantığı (Profile.jsx ve
// UserProfileView.jsx arasında paylaşılıyor). `follows` tablosunun
// profiles'a IKI ayrı FK'si var (follower_id ve following_id) - hangi
// yönü istediğimizi açıkça belirtmezsek PostgREST "birden fazla ilişki
// bulundu" hatası verir. Constraint adları migration dosyasından
// (001_baseline_schema.sql) doğrulandı, tahmin edilmedi:
// follows_follower_id_fkey / follows_following_id_fkey.
export async function fetchFollowList(session, profileId, kind) {
  const query =
    kind === "followers"
      ? `select=follower_id,profiles!follows_follower_id_fkey(display_name,handle,avatar_url)&following_id=eq.${profileId}`
      : `select=following_id,profiles!follows_following_id_fkey(display_name,handle,avatar_url)&follower_id=eq.${profileId}`;
  const rows = await supabaseSelect("follows", session?.access_token, query);
  return rows.map((r) => {
    const p = r.profiles || {};
    return {
      authorId: kind === "followers" ? r.follower_id : r.following_id,
      human: p.display_name || "Kullanıcı",
      handle: p.handle || "",
      avatarUrl: p.avatar_url || null,
    };
  });
}
